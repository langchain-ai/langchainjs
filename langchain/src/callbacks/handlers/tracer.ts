import { KVMap, BaseRun } from "langsmith/schemas";

import {
  AgentAction,
  AgentFinish,
  BaseMessage,
  ChainValues,
  LLMResult,
} from "../../schema/index.js";
import { Serialized } from "../../load/serializable.js";
import {
  BaseCallbackHandler,
  BaseCallbackHandlerInput,
  NewTokenIndices,
} from "../base.js";
import { Document } from "../../document.js";

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
    time: number;
    kwargs?: Record<string, unknown>;
  }>;
}

export interface AgentRun extends Run {
  actions: AgentAction[];
}

export abstract class BaseTracer extends BaseCallbackHandler {
  protected runMap: Map<string, Run> = new Map();

  constructor(_fields?: BaseCallbackHandlerInput) {
    super(...arguments);
  }

  copy(): this {
    return this;
  }

  protected abstract persistRun(run: Run): Promise<void>;

  protected _addChildRun(parentRun: Run, childRun: Run) {
    parentRun.child_runs.push(childRun);
  }

  protected _startTrace(run: Run) {
    if (run.parent_run_id !== undefined) {
      const parentRun = this.runMap.get(run.parent_run_id);
      if (parentRun) {
        this._addChildRun(parentRun, run);
      }
    }
    this.runMap.set(run.id, run);
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
  }

  protected _getExecutionOrder(parentRunId: string | undefined): number {
    const parentRun = parentRunId !== undefined && this.runMap.get(parentRunId);
    // If a run has no parent then execution order is 1
    if (!parentRun) {
      return 1;
    }

    return parentRun.child_execution_order + 1;
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const finalExtraParams = metadata
      ? { ...extraParams, metadata }
      : extraParams;
    const run: Run = {
      id: runId,
      name: llm.id[llm.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: llm,
      events: [
        {
          name: "start",
          time: start_time,
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

    this._startTrace(run);
    await this.onLLMStart?.(run);
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const finalExtraParams = metadata
      ? { ...extraParams, metadata }
      : extraParams;
    const run: Run = {
      id: runId,
      name: llm.id[llm.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: llm,
      events: [
        {
          name: "start",
          time: start_time,
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

    this._startTrace(run);
    await this.onLLMStart?.(run);
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    run.end_time = Date.now();
    run.outputs = output;
    run.events.push({
      name: "end",
      time: run.end_time,
    });
    await this.onLLMEnd?.(run);
    await this._endTrace(run);
  }

  async handleLLMError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    run.end_time = Date.now();
    run.error = error.message;
    run.events.push({
      name: "error",
      time: run.end_time,
    });
    await this.onLLMError?.(run);
    await this._endTrace(run);
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    runType?: string
  ): Promise<void> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const run: Run = {
      id: runId,
      name: chain.id[chain.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: chain,
      events: [
        {
          name: "start",
          time: start_time,
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

    this._startTrace(run);
    await this.onChainStart?.(run);
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run) {
      throw new Error("No chain run to end.");
    }
    run.end_time = Date.now();
    run.outputs = outputs;
    run.events.push({
      name: "end",
      time: run.end_time,
    });
    await this.onChainEnd?.(run);
    await this._endTrace(run);
  }

  async handleChainError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run) {
      throw new Error("No chain run to end.");
    }
    run.end_time = Date.now();
    run.error = error.message;
    run.events.push({
      name: "error",
      time: run.end_time,
    });
    await this.onChainError?.(run);
    await this._endTrace(run);
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const run: Run = {
      id: runId,
      name: tool.id[tool.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: tool,
      events: [
        {
          name: "start",
          time: start_time,
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

    this._startTrace(run);
    await this.onToolStart?.(run);
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "tool") {
      throw new Error("No tool run to end");
    }
    run.end_time = Date.now();
    run.outputs = { output };
    run.events.push({
      name: "end",
      time: run.end_time,
    });
    await this.onToolEnd?.(run);
    await this._endTrace(run);
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "tool") {
      throw new Error("No tool run to end");
    }
    run.end_time = Date.now();
    run.error = error.message;
    run.events.push({
      name: "error",
      time: run.end_time,
    });
    await this.onToolError?.(run);
    await this._endTrace(run);
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
      time: Date.now(),
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
      time: Date.now(),
      kwargs: { action },
    });
    await this.onAgentEnd?.(run);
  }

  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const execution_order = this._getExecutionOrder(parentRunId);
    const start_time = Date.now();
    const run: Run = {
      id: runId,
      name: retriever.id[retriever.id.length - 1],
      parent_run_id: parentRunId,
      start_time,
      serialized: retriever,
      events: [
        {
          name: "start",
          time: start_time,
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

    this._startTrace(run);
    await this.onRetrieverStart?.(run);
  }

  async handleRetrieverEnd(
    documents: Document<Record<string, unknown>>[],
    runId: string
  ): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "retriever") {
      throw new Error("No retriever run to end");
    }
    run.end_time = Date.now();
    run.outputs = { documents };
    run.events.push({
      name: "end",
      time: run.end_time,
    });
    await this.onRetrieverEnd?.(run);
    await this._endTrace(run);
  }

  async handleRetrieverError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "retriever") {
      throw new Error("No retriever run to end");
    }
    run.end_time = Date.now();
    run.error = error.message;
    run.events.push({
      name: "error",
      time: run.end_time,
    });
    await this.onRetrieverError?.(run);
    await this._endTrace(run);
  }

  async handleText(text: string, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return;
    }
    run.events.push({
      name: "text",
      time: Date.now(),
      kwargs: { text },
    });
    await this.onText?.(run);
  }

  async handleLLMNewToken(
    token: string,
    idx: NewTokenIndices,
    runId: string
  ): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "llm") {
      return;
    }
    run.events.push({
      name: "new_token",
      time: Date.now(),
      kwargs: { token, idx },
    });
    await this.onLLMNewToken?.(run);
  }

  // custom event handlers

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

  onLLMNewToken?(run: Run): void | Promise<void>;
}
