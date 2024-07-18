import { KVMap, BaseRun } from "langsmith/schemas";

import type { ChainValues } from "../utils/types/index.js";
import type { AgentAction, AgentFinish } from "../agents.js";
import type { LLMResult } from "../outputs.js";
import type { BaseMessage } from "../messages/base.js";
import { Serialized } from "../load/serializable.js";
import {
  BaseCallbackHandler,
  BaseCallbackHandlerInput,
  HandleLLMNewTokenCallbackFields,
  NewTokenIndices,
} from "../callbacks/base.js";
import type { Document } from "../documents/document.js";

export type RunType = string;

export interface Run extends BaseRun {
  // some optional fields are always present here
  id: string;
  start_time: number;
  execution_order: number;
  // some additional fields that don't exist in sdk runs
  child_runs: this[];
  child_execution_order: number;
  events: Array<{
    name: string;
    time: string;
    kwargs?: Record<string, unknown>;
  }>;
  trace_id?: string;
  dotted_order?: string;
}

export interface AgentRun extends Run {
  actions: AgentAction[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _coerceToDict(value: any, defaultKey: string) {
  return value && !Array.isArray(value) && typeof value === "object"
    ? value
    : { [defaultKey]: value };
}

function stripNonAlphanumeric(input: string) {
  return input.replace(/[-:.]/g, "");
}

function convertToDottedOrderFormat(
  epoch: number,
  runId: string,
  executionOrder: number
) {
  const paddedOrder = executionOrder.toFixed(0).slice(0, 3).padStart(3, "0");
  return (
    stripNonAlphanumeric(
      `${new Date(epoch).toISOString().slice(0, -1)}${paddedOrder}Z`
    ) + runId
  );
}

export abstract class BaseTracer extends BaseCallbackHandler {
  protected runMap: Map<string, Run> = new Map();

  constructor(_fields?: BaseCallbackHandlerInput) {
    super(...arguments);
  }

  copy(): this {
    return this;
  }

  protected stringifyError(error: unknown) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (error instanceof Error) {
      return error.message + (error?.stack ? `\n\n${error.stack}` : "");
    }

    if (typeof error === "string") {
      return error;
    }

    return `${error}`;
  }

  protected abstract persistRun(run: Run): Promise<void>;

  protected _addChildRun(parentRun: Run, childRun: Run) {
    parentRun.child_runs.push(childRun);
  }

  protected _startTrace(run: Run): Promise<void> {
    const currentDottedOrder = convertToDottedOrderFormat(
      run.start_time,
      run.id,
      run.execution_order
    );
    const storedRun = { ...run };
    if (storedRun.parent_run_id !== undefined) {
      const parentRun = this.runMap.get(storedRun.parent_run_id);
      if (parentRun) {
        this._addChildRun(parentRun, storedRun);
        parentRun.child_execution_order = Math.max(
          parentRun.child_execution_order,
          storedRun.child_execution_order
        );
        storedRun.trace_id = parentRun.trace_id;
        if (parentRun.dotted_order !== undefined) {
          storedRun.dotted_order = [
            parentRun.dotted_order,
            currentDottedOrder,
          ].join(".");
        } else {
          // This can happen naturally for callbacks added within a run
          // console.debug(`Parent run with UUID ${storedRun.parent_run_id} has no dotted order.`);
        }
      } else {
        // This can happen naturally for callbacks added within a run
        // console.debug(
        //   `Parent run with UUID ${storedRun.parent_run_id} not found.`
        // );
      }
    } else {
      storedRun.trace_id = storedRun.id;
      storedRun.dotted_order = currentDottedOrder;
    }
    this.runMap.set(storedRun.id, storedRun);
    return this.onRunCreate?.(storedRun) ?? Promise.resolve();
  }

  protected async _endTrace(run: Run): Promise<void> {
    const parentRun =
      run.parent_run_id !== undefined && this.runMap.get(run.parent_run_id);
    if (parentRun) {
      parentRun.child_execution_order = Math.max(
        parentRun.child_execution_order,
        run.child_execution_order
      );
    } else {
      await this.persistRun(run);
    }
    this.runMap.delete(run.id);
    await this.onRunUpdate?.(run);
  }

  protected _getExecutionOrder(parentRunId: string | undefined): number {
    const parentRun = parentRunId !== undefined && this.runMap.get(parentRunId);
    // If a run has no parent then execution order is 1
    if (!parentRun) {
      return 1;
    }

    return parentRun.child_execution_order + 1;
  }

  handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const finalExtraParams = metadata
      ? { ...extraParams, metadata }
      : extraParams;
    const run: Run = {
      id: runId,
      name: name ?? llm.id[llm.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: llm,
      events: [
        {
          name: "start",
          time: new Date(start_time).toISOString(),
        },
      ],
      inputs: { prompts },
      execution_order,
      child_runs: [],
      child_execution_order: execution_order,
      run_type: "llm",
      extra: finalExtraParams ?? {},
      tags: tags || [],
    };

    return this._startTrace(run)
      .then(() => this.onLLMStart?.(run))
      .then(() => run);
  }

  handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const finalExtraParams = metadata
      ? { ...extraParams, metadata }
      : extraParams;
    const run: Run = {
      id: runId,
      name: name ?? llm.id[llm.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: llm,
      events: [
        {
          name: "start",
          time: new Date(start_time).toISOString(),
        },
      ],
      inputs: { messages },
      execution_order,
      child_runs: [],
      child_execution_order: execution_order,
      run_type: "llm",
      extra: finalExtraParams ?? {},
      tags: tags || [],
    };

    return this._startTrace(run)
      .then(() => this.onLLMStart?.(run))
      .then(() => run);
  }

  handleLLMEnd(output: LLMResult, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      return Promise.reject(new Error("No LLM run to end."));
    }
    run.end_time = Date.now();
    run.outputs = output;
    run.events.push({
      name: "end",
      time: new Date(run.end_time).toISOString(),
    });
    return (this.onLLMEnd?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleLLMError(error: unknown, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      return Promise.reject(new Error("No LLM run to end."));
    }
    run.end_time = Date.now();
    run.error = this.stringifyError(error);
    run.events.push({
      name: "error",
      time: new Date(run.end_time).toISOString(),
    });
    return (this.onLLMError?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    runType?: string,
    name?: string
  ): Promise<Run> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const run: Run = {
      id: runId,
      name: name ?? chain.id[chain.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: chain,
      events: [
        {
          name: "start",
          time: new Date(start_time).toISOString(),
        },
      ],
      inputs,
      execution_order,
      child_execution_order: execution_order,
      run_type: runType ?? "chain",
      child_runs: [],
      extra: metadata ? { metadata } : {},
      tags: tags || [],
    };
    return this._startTrace(run)
      .then(() => this.onChainStart?.(run))
      .then(() => run);
  }

  handleChainEnd(
    outputs: ChainValues,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run) {
      return Promise.reject(new Error("No chain run to end."));
    }
    run.end_time = Date.now();
    run.outputs = _coerceToDict(outputs, "output");
    run.events.push({
      name: "end",
      time: new Date(run.end_time).toISOString(),
    });
    if (kwargs?.inputs !== undefined) {
      run.inputs = _coerceToDict(kwargs.inputs, "input");
    }
    return (this.onChainEnd?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleChainError(
    error: unknown,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run) {
      return Promise.reject(new Error("No chain run to end."));
    }
    run.end_time = Date.now();
    run.error = this.stringifyError(error);
    run.events.push({
      name: "error",
      time: new Date(run.end_time).toISOString(),
    });
    if (kwargs?.inputs !== undefined) {
      run.inputs = _coerceToDict(kwargs.inputs, "input");
    }
    return (this.onChainError?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const run: Run = {
      id: runId,
      name: name ?? tool.id[tool.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: tool,
      events: [
        {
          name: "start",
          time: new Date(start_time).toISOString(),
        },
      ],
      inputs: { input },
      execution_order,
      child_execution_order: execution_order,
      run_type: "tool",
      child_runs: [],
      extra: metadata ? { metadata } : {},
      tags: tags || [],
    };

    return this._startTrace(run)
      .then(() => this.onToolStart?.(run))
      .then(() => run);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleToolEnd(output: any, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "tool") {
      return Promise.reject(new Error("No tool run to end"));
    }
    run.end_time = Date.now();
    run.outputs = { output };
    run.events.push({
      name: "end",
      time: new Date(run.end_time).toISOString(),
    });
    return (this.onToolEnd?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleToolError(error: unknown, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "tool") {
      return Promise.reject(new Error("No tool run to end"));
    }
    run.end_time = Date.now();
    run.error = this.stringifyError(error);
    run.events.push({
      name: "error",
      time: new Date(run.end_time).toISOString(),
    });
    return (this.onToolError?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleAgentAction(action: AgentAction, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return Promise.resolve();
    }
    const agentRun = run as AgentRun;
    agentRun.actions = agentRun.actions || [];
    agentRun.actions.push(action);
    agentRun.events.push({
      name: "agent_action",
      time: new Date().toISOString(),
      kwargs: { action },
    });
    return this.onAgentAction?.(run as AgentRun) ?? Promise.resolve();
  }

  handleAgentEnd(action: AgentFinish, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return Promise.resolve();
    }
    run.events.push({
      name: "agent_end",
      time: new Date().toISOString(),
      kwargs: { action },
    });
    return this.onAgentEnd?.(run) ?? Promise.resolve();
  }

  handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const run: Run = {
      id: runId,
      name: name ?? retriever.id[retriever.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: retriever,
      events: [
        {
          name: "start",
          time: new Date(start_time).toISOString(),
        },
      ],
      inputs: { query },
      execution_order,
      child_execution_order: execution_order,
      run_type: "retriever",
      child_runs: [],
      extra: metadata ? { metadata } : {},
      tags: tags || [],
    };

    return this._startTrace(run)
      .then(() => this.onRetrieverStart?.(run))
      .then(() => run);
  }

  handleRetrieverEnd(
    documents: Document<Record<string, unknown>>[],
    runId: string
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "retriever") {
      return Promise.reject(new Error("No retriever run to end"));
    }
    run.end_time = Date.now();
    run.outputs = { documents };
    run.events.push({
      name: "end",
      time: new Date(run.end_time).toISOString(),
    });
    return (this.onRetrieverEnd?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleRetrieverError(error: unknown, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "retriever") {
      return Promise.reject(new Error("No retriever run to end"));
    }
    run.end_time = Date.now();
    run.error = this.stringifyError(error);
    run.events.push({
      name: "error",
      time: new Date(run.end_time).toISOString(),
    });
    return (this.onRetrieverError?.(run) ?? Promise.resolve())
      .then(() => this._endTrace(run))
      .then(() => run);
  }

  handleText(text: string, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return Promise.resolve();
    }
    run.events.push({
      name: "text",
      time: new Date().toISOString(),
      kwargs: { text },
    });
    return this.onText?.(run) ?? Promise.resolve();
  }

  handleLLMNewToken(
    token: string,
    idx: NewTokenIndices,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    fields?: HandleLLMNewTokenCallbackFields
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      return Promise.reject(
        new Error(`Invalid "runId" provided to "handleLLMNewToken" callback.`)
      );
    }
    run.events.push({
      name: "new_token",
      time: new Date().toISOString(),
      kwargs: { token, idx, chunk: fields?.chunk },
    });
    return (
      this.onLLMNewToken?.(run, token, { chunk: fields?.chunk }) ??
      Promise.resolve()
    ).then(() => run);
  }

  // custom event handlers

  onRunCreate?(run: Run): void | Promise<void>;

  onRunUpdate?(run: Run): void | Promise<void>;

  onLLMStart?(run: Run): void | Promise<void>;

  onLLMEnd?(run: Run): void | Promise<void>;

  onLLMError?(run: Run): void | Promise<void>;

  onChainStart?(run: Run): void | Promise<void>;

  onChainEnd?(run: Run): void | Promise<void>;

  onChainError?(run: Run): void | Promise<void>;

  onToolStart?(run: Run): void | Promise<void>;

  onToolEnd?(run: Run): void | Promise<void>;

  onToolError?(run: Run): void | Promise<void>;

  onAgentAction?(run: Run): void | Promise<void>;

  onAgentEnd?(run: Run): void | Promise<void>;

  onRetrieverStart?(run: Run): void | Promise<void>;

  onRetrieverEnd?(run: Run): void | Promise<void>;

  onRetrieverError?(run: Run): void | Promise<void>;

  onText?(run: Run): void | Promise<void>;

  onLLMNewToken?(
    run: Run,
    token: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kwargs?: { chunk: any }
  ): void | Promise<void>;
}
