import {
  type Client,
  type LangSmithTracingClientInterface,
  getDefaultProjectName,
} from "langsmith";
import { RunTree, type RunTreeConfig } from "langsmith/run_trees";
import { getCurrentRunTree } from "langsmith/singletons/traceable";

import {
  BaseRun,
  RunCreate,
  RunUpdate as BaseRunUpdate,
  KVMap,
} from "langsmith/schemas";
import { BaseTracer, Run as BaseTracerRun } from "./base.js";
import { BaseCallbackHandlerInput } from "../callbacks/base.js";
import { getDefaultLangChainClientSingleton } from "../singletons/tracer.js";
import { ChatGeneration } from "../outputs.js";
import { AIMessage } from "../messages/ai.js";
import { mergeUsageMetadata, UsageMetadata } from "../messages/metadata.js";

export interface Run extends BaseRun {
  id: string;
  child_runs: this[];
  child_execution_order: number;
  dotted_order?: string;
  trace_id?: string;
}

export interface RunCreate2 extends RunCreate {
  trace_id?: string;
  dotted_order?: string;
}

export interface RunUpdate extends BaseRunUpdate {
  events: BaseRun["events"];
  inputs: KVMap;
  trace_id?: string;
  dotted_order?: string;
}

export interface LangChainTracerFields extends BaseCallbackHandlerInput {
  exampleId?: string;
  projectName?: string;
  client?: LangSmithTracingClientInterface;
  replicas?: RunTreeConfig["replicas"];
}

/**
 * Extract usage_metadata from chat generations.
 *
 * Iterates through generations to find and aggregates all usage_metadata
 * found in chat messages. This is typically present in chat model outputs.
 */
function _getUsageMetadataFromGenerations(
  generations: ChatGeneration[][]
): UsageMetadata | undefined {
  let output: UsageMetadata | undefined = undefined;
  for (const generationBatch of generations) {
    for (const generation of generationBatch) {
      if (
        AIMessage.isInstance(generation.message) &&
        generation.message.usage_metadata !== undefined
      ) {
        output = mergeUsageMetadata(output, generation.message.usage_metadata);
      }
    }
  }
  return output;
}

export class LangChainTracer
  extends BaseTracer
  implements LangChainTracerFields
{
  name = "langchain_tracer";

  projectName?: string;

  exampleId?: string;

  client: LangSmithTracingClientInterface;

  replicas?: RunTreeConfig["replicas"];

  usesRunTreeMap = true;

  constructor(fields: LangChainTracerFields = {}) {
    super(fields);
    const { exampleId, projectName, client, replicas } = fields;

    this.projectName = projectName ?? getDefaultProjectName();
    this.replicas = replicas;
    this.exampleId = exampleId;
    this.client = client ?? getDefaultLangChainClientSingleton();

    const traceableTree = LangChainTracer.getTraceableRunTree();
    if (traceableTree) {
      this.updateFromRunTree(traceableTree);
    }
  }

  protected async persistRun(_run: Run): Promise<void> {
    // empty
  }

  /**
   * Resolve lc_tracing_only_metadata for a run by combining inherited parent
   * metadata with the run's own, then merge into runTree.metadata.
   * The run's own values take precedence over inherited ones.
   */
  private _applyTracingOnlyMetadata(run: Run, runTree: RunTree): void {
    // Collect inherited lc_tracing_only_metadata from parent
    const parentRun = run.parent_run_id
      ? this.getRunById(run.parent_run_id)
      : undefined;
    const inherited = parentRun?.extra?.lc_tracing_only_metadata;
    const own = run.extra?.lc_tracing_only_metadata;

    if (!inherited && !own) return;

    // Inherited first, then own values take precedence
    const merged = { ...inherited, ...own };
    runTree.metadata = {
      ...runTree.metadata,
      ...merged,
    };
    delete runTree.extra.lc_tracing_only_metadata;
  }

  async onRunCreate(run: Run): Promise<void> {
    if (!run.extra?.lc_defers_inputs) {
      const runTree = this.getRunTreeWithTracingConfig(run.id);
      if (runTree) {
        this._applyTracingOnlyMetadata(run, runTree);
      }
      await runTree?.postRun();
    }
  }

  async onRunUpdate(run: Run): Promise<void> {
    const runTree = this.getRunTreeWithTracingConfig(run.id);
    if (runTree) {
      this._applyTracingOnlyMetadata(run, runTree);
    }
    if (run.extra?.lc_defers_inputs) {
      await runTree?.postRun();
    } else {
      await runTree?.patchRun();
    }
  }

  onLLMEnd(run: BaseTracerRun): void {
    // Extract usage_metadata from outputs and store in extra.metadata
    const outputs = run.outputs as
      | { generations?: ChatGeneration[][] }
      | undefined;
    if (outputs?.generations) {
      const usageMetadata = _getUsageMetadataFromGenerations(
        outputs.generations
      );
      if (usageMetadata !== undefined) {
        run.extra = run.extra ?? {};
        const metadata =
          (run.extra.metadata as Record<string, unknown> | undefined) ?? {};
        metadata.usage_metadata = usageMetadata;
        run.extra.metadata = metadata;
      }
    }
  }

  getRun(id: string): Run | undefined {
    return this.runTreeMap.get(id);
  }

  updateFromRunTree(runTree: RunTree) {
    this.runTreeMap.set(runTree.id, runTree);
    let rootRun: RunTree = runTree;
    const visited = new Set<string>();
    while (rootRun.parent_run) {
      if (visited.has(rootRun.id)) break;
      visited.add(rootRun.id);

      if (!rootRun.parent_run) break;
      rootRun = rootRun.parent_run as RunTree;
    }
    visited.clear();

    const queue = [rootRun];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);

      this.runTreeMap.set(current.id, current);
      if (current.child_runs) {
        queue.push(...current.child_runs);
      }
    }

    this.client = runTree.client ?? this.client;
    this.replicas = runTree.replicas ?? this.replicas;
    this.projectName = runTree.project_name ?? this.projectName;
    this.exampleId = runTree.reference_example_id ?? this.exampleId;
  }

  getRunTreeWithTracingConfig(id: string): RunTree | undefined {
    const runTree = this.runTreeMap.get(id);
    if (!runTree) return undefined;

    return new RunTree({
      ...runTree,
      client: this.client as Client,
      project_name: this.projectName,
      replicas: this.replicas,
      reference_example_id: this.exampleId,
      tracingEnabled: true,
    });
  }

  static getTraceableRunTree(): RunTree | undefined {
    try {
      return (
        // The type cast here provides forward compatibility. Old versions of LangSmith will just
        // ignore the permitAbsentRunTree arg.
        (
          getCurrentRunTree as (
            permitAbsentRunTree: boolean
          ) => ReturnType<typeof getCurrentRunTree> | undefined
        )(true)
      );
    } catch {
      return undefined;
    }
  }
}
