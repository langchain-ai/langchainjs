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

export function isBaseTracer(x: BaseCallbackHandler): x is BaseTracer {
  return typeof (x as BaseTracer)._addRunToRunMap === "function";
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

  _addRunToRunMap(run: Run) {
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
    return storedRun;
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

  /**
   * Create and add a run to the run map for LLM start events.
   * This must sometimes be done synchronously to avoid race conditions
   * when callbacks are backgrounded, so we expose it as a separate method here.
   */
  _createRunForLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ) {
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
    return this._addRunToRunMap(run);
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const run =
      this.runMap.get(runId) ??
      this._createRunForLLMStart(
        llm,
        prompts,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name
      );
    await this.onRunCreate?.(run);
    await this.onLLMStart?.(run);
    return run;
  }

  /**
   * Create and add a run to the run map for chat model start events.
   * This must sometimes be done synchronously to avoid race conditions
   * when callbacks are backgrounded, so we expose it as a separate method here.
   */
  _createRunForChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ) {
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
    return this._addRunToRunMap(run);
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const run =
      this.runMap.get(runId) ??
      this._createRunForChatModelStart(
        llm,
        messages,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name
      );
    await this.onRunCreate?.(run);
    await this.onLLMStart?.(run);
    return run;
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    run.end_time = Date.now();
    run.outputs = output;
    run.events.push({
      name: "end",
      time: new Date(run.end_time).toISOString(),
    });
    run.extra = { ...run.extra, ...extraParams };
    await this.onLLMEnd?.(run);
    await this._endTrace(run);
    return run;
  }

  async handleLLMError(
    error: unknown,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    run.end_time = Date.now();
    run.error = this.stringifyError(error);
    run.events.push({
      name: "error",
      time: new Date(run.end_time).toISOString(),
    });
    run.extra = { ...run.extra, ...extraParams };
    await this.onLLMError?.(run);
    await this._endTrace(run);
    return run;
  }

  /**
   * Create and add a run to the run map for chain start events.
   * This must sometimes be done synchronously to avoid race conditions
   * when callbacks are backgrounded, so we expose it as a separate method here.
   */
  _createRunForChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    runType?: string,
    name?: string
  ) {
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
    return this._addRunToRunMap(run);
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    runType?: string,
    name?: string
  ): Promise<Run> {
    const run =
      this.runMap.get(runId) ??
      this._createRunForChainStart(
        chain,
        inputs,
        runId,
        parentRunId,
        tags,
        metadata,
        runType,
        name
      );
    await this.onRunCreate?.(run);
    await this.onChainStart?.(run);
    return run;
  }

  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run) {
      throw new Error("No chain run to end.");
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
    await this.onChainEnd?.(run);
    await this._endTrace(run);
    return run;
  }

  async handleChainError(
    error: unknown,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run) {
      throw new Error("No chain run to end.");
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
    await this.onChainError?.(run);
    await this._endTrace(run);
    return run;
  }

  /**
   * Create and add a run to the run map for tool start events.
   * This must sometimes be done synchronously to avoid race conditions
   * when callbacks are backgrounded, so we expose it as a separate method here.
   */
  _createRunForToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ) {
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
    return this._addRunToRunMap(run);
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const run =
      this.runMap.get(runId) ??
      this._createRunForToolStart(
        tool,
        input,
        runId,
        parentRunId,
        tags,
        metadata,
        name
      );
    await this.onRunCreate?.(run);
    await this.onToolStart?.(run);
    return run;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handleToolEnd(output: any, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "tool") {
      throw new Error("No tool run to end");
    }
    run.end_time = Date.now();
    run.outputs = { output };
    run.events.push({
      name: "end",
      time: new Date(run.end_time).toISOString(),
    });
    await this.onToolEnd?.(run);
    await this._endTrace(run);
    return run;
  }

  async handleToolError(error: unknown, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "tool") {
      throw new Error("No tool run to end");
    }
    run.end_time = Date.now();
    run.error = this.stringifyError(error);
    run.events.push({
      name: "error",
      time: new Date(run.end_time).toISOString(),
    });
    await this.onToolError?.(run);
    await this._endTrace(run);
    return run;
  }

  async handleAgentAction(action: AgentAction, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return;
    }
    const agentRun = run as AgentRun;
    agentRun.actions = agentRun.actions || [];
    agentRun.actions.push(action);
    agentRun.events.push({
      name: "agent_action",
      time: new Date().toISOString(),
      kwargs: { action },
    });
    await this.onAgentAction?.(run as AgentRun);
  }

  async handleAgentEnd(action: AgentFinish, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return;
    }
    run.events.push({
      name: "agent_end",
      time: new Date().toISOString(),
      kwargs: { action },
    });
    await this.onAgentEnd?.(run);
  }

  /**
   * Create and add a run to the run map for retriever start events.
   * This must sometimes be done synchronously to avoid race conditions
   * when callbacks are backgrounded, so we expose it as a separate method here.
   */
  _createRunForRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ) {
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
    return this._addRunToRunMap(run);
  }

  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    const run =
      this.runMap.get(runId) ??
      this._createRunForRetrieverStart(
        retriever,
        query,
        runId,
        parentRunId,
        tags,
        metadata,
        name
      );
    await this.onRunCreate?.(run);
    await this.onRetrieverStart?.(run);
    return run;
  }

  async handleRetrieverEnd(
    documents: Document<Record<string, unknown>>[],
    runId: string
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "retriever") {
      throw new Error("No retriever run to end");
    }
    run.end_time = Date.now();
    run.outputs = { documents };
    run.events.push({
      name: "end",
      time: new Date(run.end_time).toISOString(),
    });
    await this.onRetrieverEnd?.(run);
    await this._endTrace(run);
    return run;
  }

  async handleRetrieverError(error: unknown, runId: string): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "retriever") {
      throw new Error("No retriever run to end");
    }
    run.end_time = Date.now();
    run.error = this.stringifyError(error);
    run.events.push({
      name: "error",
      time: new Date(run.end_time).toISOString(),
    });
    await this.onRetrieverError?.(run);
    await this._endTrace(run);
    return run;
  }

  async handleText(text: string, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return;
    }
    run.events.push({
      name: "text",
      time: new Date().toISOString(),
      kwargs: { text },
    });
    await this.onText?.(run);
  }

  async handleLLMNewToken(
    token: string,
    idx: NewTokenIndices,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    fields?: HandleLLMNewTokenCallbackFields
  ): Promise<Run> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      throw new Error(
        `Invalid "runId" provided to "handleLLMNewToken" callback.`
      );
    }
    run.events.push({
      name: "new_token",
      time: new Date().toISOString(),
      kwargs: { token, idx, chunk: fields?.chunk },
    });
    await this.onLLMNewToken?.(run, token, { chunk: fields?.chunk });
    return run;
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
