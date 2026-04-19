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
  metadata?: Record<string, unknown>;
  tags?: string[];
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

  tracingMetadata?: Record<string, unknown>;

  tracingTags: string[] = [];

  constructor(protected fields: LangChainTracerFields = {}) {
    super(fields);
    const { exampleId, projectName, client, replicas, metadata, tags } = fields;

    this.projectName = projectName ?? getDefaultProjectName();
    this.replicas = replicas;
    this.exampleId = exampleId;
    this.client = client ?? getDefaultLangChainClientSingleton();
    this.tracingMetadata = metadata ? { ...metadata } : undefined;
    this.tracingTags = tags ?? [];

    const traceableTree = LangChainTracer.getTraceableRunTree();
    if (traceableTree) {
      this.updateFromRunTree(traceableTree);
    }
  }

  protected async persistRun(_run: Run): Promise<void> {
    // empty
  }

  async onRunCreate(run: Run): Promise<void> {
    _patchMissingTracingDefaults(this, run);
    if (!run.extra?.lc_defers_inputs) {
      const runTree = this.getRunTreeWithTracingConfig(run.id);
      await runTree?.postRun();
    }
  }

  async onRunUpdate(run: Run): Promise<void> {
    _patchMissingTracingDefaults(this, run);
    const runTree = this.getRunTreeWithTracingConfig(run.id);
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

  copyWithTracingConfig({
    metadata,
    tags,
  }: {
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): LangChainTracer {
    let mergedMetadata: Record<string, unknown> | undefined;
    if (metadata === undefined) {
      mergedMetadata = this.tracingMetadata
        ? { ...this.tracingMetadata }
        : undefined;
    } else if (this.tracingMetadata === undefined) {
      mergedMetadata = { ...metadata };
    } else {
      mergedMetadata = { ...this.tracingMetadata };
      for (const [key, value] of Object.entries(metadata)) {
        if (!Object.prototype.hasOwnProperty.call(mergedMetadata, key)) {
          mergedMetadata[key] = value;
        }
      }
    }

    const mergedTags = tags
      ? Array.from(new Set([...this.tracingTags, ...tags]))
      : [...this.tracingTags];

    const copied = new LangChainTracer({
      ...this.fields,
      metadata: mergedMetadata,
      tags: mergedTags,
    });
    copied.runMap = this.runMap;
    copied.runTreeMap = this.runTreeMap;
    return copied;
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
    this.fields = {
      ...this.fields,
      client: this.client,
      replicas: this.replicas,
      projectName: this.projectName,
      exampleId: this.exampleId,
    };
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

  static [Symbol.hasInstance](instance: unknown): boolean {
    if (typeof instance !== "object" || instance === null) {
      return false;
    }
    const candidate = instance as Record<string, unknown>;
    return (
      "name" in candidate &&
      candidate.name === "langchain_tracer" &&
      "copyWithTracingConfig" in candidate &&
      typeof candidate.copyWithTracingConfig === "function" &&
      "getRunTreeWithTracingConfig" in candidate &&
      typeof candidate.getRunTreeWithTracingConfig === "function"
    );
  }
}

function _patchMissingTracingDefaults(tracer: LangChainTracer, run: Run): void {
  if (tracer.tracingMetadata) {
    run.extra ??= {};
    const metadata: Record<string, unknown> =
      (run.extra.metadata as Record<string, unknown> | undefined) ?? {};
    let didPatchMetadata = false;
    for (const [key, value] of Object.entries(tracer.tracingMetadata)) {
      if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
        metadata[key] = value;
        didPatchMetadata = true;
      }
    }
    if (didPatchMetadata) {
      run.extra.metadata = metadata;
    }
  }

  if (tracer.tracingTags.length > 0) {
    run.tags = Array.from(
      new Set([...(run.tags ?? []), ...tracer.tracingTags])
    );
  }
}
