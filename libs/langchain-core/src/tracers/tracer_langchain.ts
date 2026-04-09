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
import {
  BaseCallbackHandler,
  BaseCallbackHandlerInput,
} from "../callbacks/base.js";
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
  /**
   * Additional metadata to include on runs if it isn't already present.
   * Applied only at persist-time so it does not flow through stream events.
   */
  metadata?: Record<string, string>;
}

/** @internal Constructor-only fields (not part of the `implements` contract). */
interface LangChainTracerConstructorFields extends LangChainTracerFields {
  /** Optional shared runTreeMap so that copied tracers see the same run state. */
  runTreeMap?: Map<string, RunTree>;
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

  /**
   * Tracer-only metadata defaults. Added to runs at persist-time for keys
   * that are not already present, so it never inflates stream events.
   */
  tracingMetadata: Record<string, string> | undefined;

  /**
   * Tracer-only tags. Merged onto runs at persist-time.
   */
  tracingTags: string[];

  constructor(fields: LangChainTracerConstructorFields = {}) {
    super(fields);
    const { exampleId, projectName, client, replicas, metadata } = fields;

    this.projectName = projectName ?? getDefaultProjectName();
    this.replicas = replicas;
    this.exampleId = exampleId;
    this.client = client ?? getDefaultLangChainClientSingleton();
    this.tracingMetadata = metadata !== undefined ? { ...metadata } : undefined;
    this.tracingTags = [];

    const traceableTree = LangChainTracer.getTraceableRunTree();
    if (traceableTree) {
      this.updateFromRunTree(traceableTree);
    }
  }

  /**
   * Return a new tracer that shares the same `runTreeMap` (so parent/child
   * linkage is preserved) but carries merged tracer-only metadata defaults.
   *
   * - Keys already present on the current tracer take precedence.
   * - The original tracer is never mutated.
   */
  copyWithMetadataDefaults(options: {
    metadata?: Record<string, string>;
    tags?: string[];
  }): LangChainTracer {
    const { metadata, tags } = options;
    const baseMetadata = this.tracingMetadata;

    let mergedMetadata: Record<string, string> | undefined;
    if (metadata == null) {
      mergedMetadata = baseMetadata != null ? { ...baseMetadata } : undefined;
    } else if (baseMetadata == null) {
      mergedMetadata = { ...metadata };
    } else {
      mergedMetadata = { ...baseMetadata };
      for (const [key, value] of Object.entries(metadata)) {
        if (!(key in mergedMetadata)) {
          mergedMetadata[key] = value;
        }
      }
    }

    const mergedTags = tags
      ? [...new Set([...this.tracingTags, ...tags])].sort()
      : [...this.tracingTags];

    const copied = new LangChainTracer({
      exampleId: this.exampleId,
      projectName: this.projectName,
      client: this.client,
      replicas: this.replicas,
      metadata: mergedMetadata,
      runTreeMap: this.runTreeMap,
    });
    copied.tracingTags = mergedTags;
    return copied;
  }

  protected async persistRun(_run: Run): Promise<void> {
    // empty
  }

  async onRunCreate(run: Run): Promise<void> {
    if (!run.extra?.lc_defers_inputs) {
      const runTree = this.getRunTreeWithTracingConfig(run.id);
      await runTree?.postRun();
    }
  }

  async onRunUpdate(run: Run): Promise<void> {
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

    const tree = new RunTree({
      ...runTree,
      client: this.client as Client,
      project_name: this.projectName,
      replicas: this.replicas,
      reference_example_id: this.exampleId,
      tracingEnabled: true,
    });

    _patchMissingMetadata(this, tree);
    return tree;
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

/**
 * Patch tracer-level metadata into a run/RunTree for any keys that are not
 * already present. This ensures the metadata flows to LangSmith without
 * inflating the metadata dict that travels through every stream event.
 *
 * The run's existing metadata is copied on the first miss to avoid mutating
 * the shared dict owned by the callback manager.
 */
export function _patchMissingMetadata(
  tracer: LangChainTracer,
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  run: { extra?: Record<string, any> }
): void {
  const tracingMetadata = tracer.tracingMetadata;
  if (!tracingMetadata) return;

  const metadata =
    (run.extra?.metadata as Record<string, unknown> | undefined) ?? {};
  let patched: Record<string, unknown> | undefined;

  for (const [k, v] of Object.entries(tracingMetadata)) {
    if (!(k in metadata)) {
      if (patched == null) {
        // Copy on first miss to avoid mutating the shared dict.
        patched = { ...metadata };
        run.extra = { ...(run.extra ?? {}), metadata: patched };
      }
      patched[k] = v;
    }
  }
}

/**
 * Known configurable keys whose string values should be forwarded as
 * LangSmith-only inheritable metadata (instead of being copied into the
 * shared `metadata` dict that flows through every stream event).
 */
export const CONFIGURABLE_TO_METADATA_KEYS = new Set([
  "thread_id",
  "run_id",
  "task_id",
  "checkpoint_id",
  "checkpoint_ns",
  "assistant_id",
  "graph_id",
  "model",
  "user_id",
  "cron_id",
  "langgraph_auth_user_id",
]);

/**
 * Extract LangSmith-only inheritable metadata defaults from a
 * `configurable` dict.
 *
 * Only string values for keys in {@link CONFIGURABLE_TO_METADATA_KEYS} are
 * included. Returns `undefined` when there is nothing to forward.
 */
export function getInheritableMetadataFromConfigurable(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  configurable?: Record<string, any>
): Record<string, string> | undefined {
  if (!configurable) return undefined;

  let metadata: Record<string, string> | undefined;
  for (const key of CONFIGURABLE_TO_METADATA_KEYS) {
    const value = configurable[key];
    if (typeof value === "string") {
      if (!metadata) metadata = {};
      metadata[key] = value;
    }
  }
  return metadata;
}

/**
 * Extract known configurable keys and apply them as LangSmith-only
 * metadata defaults on any {@link LangChainTracer} handlers found in
 * `handlers` and `inheritableHandlers`.
 *
 * Tracers are replaced with shallow copies so the metadata never leaks
 * into the shared callback-manager metadata dict (which flows through
 * every stream event). Non-tracer handlers are left untouched.
 *
 * This is a no-op when `configurable` is `undefined` or contains no
 * relevant keys.
 *
 * @internal
 */
export function applyConfigurableMetadataToTracers(
  handlers: {
    handlers: BaseCallbackHandler[];
    inheritableHandlers: BaseCallbackHandler[];
  },
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  configurable?: Record<string, any>
): void {
  const metadata = getInheritableMetadataFromConfigurable(configurable);
  if (!metadata) return;

  const replace = (list: BaseCallbackHandler[]) =>
    list.map((h) =>
      h instanceof LangChainTracer
        ? h.copyWithMetadataDefaults({ metadata })
        : h
    );

  handlers.handlers = replace(handlers.handlers);
  handlers.inheritableHandlers = replace(handlers.inheritableHandlers);
}
