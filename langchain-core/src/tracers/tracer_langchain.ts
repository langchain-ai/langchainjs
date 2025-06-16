import type { Client, LangSmithTracingClientInterface } from "langsmith";
import { RunTree } from "langsmith/run_trees";
import { getCurrentRunTree } from "langsmith/singletons/traceable";

import {
  BaseRun,
  RunCreate,
  RunUpdate as BaseRunUpdate,
  KVMap,
} from "langsmith/schemas";
import {
  getEnvironmentVariable,
  getRuntimeEnvironmentSync,
} from "../utils/env.js";
import { BaseTracer } from "./base.js";
import { BaseCallbackHandlerInput } from "../callbacks/base.js";
import { getDefaultLangChainClientSingleton } from "../singletons/tracer.js";

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
  replicas?: RunTree["replicas"];
}

export class LangChainTracer
  extends BaseTracer
  implements LangChainTracerFields
{
  name = "langchain_tracer";

  projectName?: string;

  exampleId?: string;

  client: LangSmithTracingClientInterface;

  replicas?: RunTree["replicas"];

  constructor(fields: LangChainTracerFields = {}) {
    super(fields);
    const { exampleId, projectName, client, replicas } = fields;

    this.projectName =
      projectName ??
      getEnvironmentVariable("LANGCHAIN_PROJECT") ??
      getEnvironmentVariable("LANGCHAIN_SESSION");
    this.replicas = replicas;
    this.exampleId = exampleId;
    this.client = client ?? getDefaultLangChainClientSingleton();

    const traceableTree = LangChainTracer.getTraceableRunTree();
    if (traceableTree) {
      this.updateFromRunTree(traceableTree);
    }
  }

  protected async persistRun(_run: Run): Promise<void> {}

  async onRunCreate(run: Run): Promise<void> {
    const runTree = this.convertToRunTree(run.id);
    await runTree?.postRun();
  }

  async onRunUpdate(run: Run): Promise<void> {
    const runTree = this.convertToRunTree(run.id);
    await runTree?.patchRun();
  }

  getRun(id: string): Run | undefined {
    return this.runMap.get(id);
  }

  updateFromRunTree(runTree: RunTree) {
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

      // @ts-expect-error Types of property 'events' are incompatible.
      this.runMap.set(current.id, current);
      if (current.child_runs) {
        queue.push(...current.child_runs);
      }
    }

    this.client = runTree.client ?? this.client;
    this.replicas = runTree.replicas ?? this.replicas;
    this.projectName = runTree.project_name ?? this.projectName;
    this.exampleId = runTree.reference_example_id ?? this.exampleId;
  }

  convertToRunTree(id: string): RunTree | undefined {
    const runTreeMap: Record<string, RunTree> = {};
    const runTreeList: [id: string, dotted_order: string | undefined][] = [];
    for (const [id, run] of this.runMap) {
      // by converting the run map to a run tree, we are doing a copy
      // thus, any mutation performed on the run tree will not be reflected
      // back in the run map
      // TODO: Stop using `this.runMap` in favour of LangSmith's `RunTree`
      const runTree = new RunTree({
        ...run,
        extra: {
          ...run.extra,
          runtime: getRuntimeEnvironmentSync(),
        },
        child_runs: [],
        parent_run: undefined,

        // inherited properties
        client: this.client as Client,
        project_name: this.projectName,
        replicas: this.replicas,
        reference_example_id: this.exampleId,
        tracingEnabled: true,
      });

      runTreeMap[id] = runTree;
      runTreeList.push([id, run.dotted_order]);
    }

    runTreeList.sort((a, b) => {
      if (!a[1] || !b[1]) return 0;
      return a[1].localeCompare(b[1]);
    });

    for (const [id] of runTreeList) {
      const run = this.runMap.get(id);
      const runTree = runTreeMap[id];
      if (!run || !runTree) continue;

      if (run.parent_run_id) {
        const parentRunTree = runTreeMap[run.parent_run_id];
        if (parentRunTree) {
          parentRunTree.child_runs.push(runTree);
          runTree.parent_run = parentRunTree;
        }
      }
    }

    return runTreeMap[id];
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
