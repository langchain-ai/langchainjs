import { ChainValues, LLMResult } from "../../schema/index.js";
import { BaseCallbackHandler } from "../base.js";

export type RunType = "llm" | "chain" | "tool";

export interface BaseTracerSession {
  start_time: number;
  name?: string;
}

export type TracerSessionCreate = BaseTracerSession;

export interface TracerSession extends BaseTracerSession {
  id: number;
}

export interface BaseRun {
  uuid: string;
  parent_uuid?: string;
  start_time: number;
  end_time: number;
  execution_order: number;
  serialized: { name: string };
  session_id: number;
  error?: string;
  type: RunType;
}

export interface LLMRun extends BaseRun {
  prompts: string[];
  response?: LLMResult;
}

export interface ChainRun extends BaseRun {
  inputs: ChainValues;
  outputs?: ChainValues;
  child_llm_runs: LLMRun[];
  child_chain_runs: ChainRun[];
  child_tool_runs: ToolRun[];
}

export interface ToolRun extends BaseRun {
  tool_input: string;
  output?: string;
  action: string;
  child_llm_runs: LLMRun[];
  child_chain_runs: ChainRun[];
  child_tool_runs: ToolRun[];
}

export abstract class BaseTracer extends BaseCallbackHandler {
  protected session?: TracerSession;

  protected runMap: Map<string, LLMRun | ChainRun | ToolRun> = new Map();

  protected executionOrder = 1;

  protected constructor() {
    super();
  }

  abstract loadSession(sessionName: string): Promise<TracerSession>;

  abstract loadDefaultSession(): Promise<TracerSession>;

  protected abstract persistRun(
    run: LLMRun | ChainRun | ToolRun
  ): Promise<void>;

  protected abstract persistSession(
    session: TracerSessionCreate
  ): Promise<TracerSession>;

  async newSession(sessionName?: string): Promise<TracerSession> {
    const sessionCreate: TracerSessionCreate = {
      start_time: Date.now(),
      name: sessionName,
    };
    const session = await this.persistSession(sessionCreate);
    this.session = session;
    return session;
  }

  protected _addChildRun(
    parentRun: ChainRun | ToolRun,
    childRun: LLMRun | ChainRun | ToolRun
  ) {
    if (childRun.type === "llm") {
      parentRun.child_llm_runs.push(childRun as LLMRun);
    } else if (childRun.type === "chain") {
      parentRun.child_chain_runs.push(childRun as ChainRun);
    } else if (childRun.type === "tool") {
      parentRun.child_tool_runs.push(childRun as ToolRun);
    } else {
      throw new Error("Invalid run type");
    }
  }

  protected _startTrace(run: LLMRun | ChainRun | ToolRun) {
    this.executionOrder += 1;

    if (run.parent_uuid) {
      const parentRun = this.runMap.get(run.parent_uuid);
      if (parentRun) {
        if (!(parentRun.type === "tool" || parentRun.type === "chain")) {
          throw new Error("Caller run can only be a tool or chain");
        } else {
          this._addChildRun(parentRun as ChainRun | ToolRun, run);
        }
      } else {
        throw new Error(`Caller run ${run.parent_uuid} not found`);
      }
    }
    this.runMap.set(run.uuid, run);
  }

  protected async _endTrace(run: LLMRun | ChainRun | ToolRun): Promise<void> {
    if (!run.parent_uuid) {
      await this.persistRun(run);
      this.executionOrder = 1;
    }
    this.runMap.delete(run.uuid);
  }

  async handleLLMStart(
    llm: { name: string },
    prompts: string[],
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: LLMRun = {
      uuid: runId,
      parent_uuid: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: llm,
      prompts,
      session_id: this.session.id,
      execution_order: this.executionOrder,
      type: "llm",
    };

    this._startTrace(run);
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    const llmRun = run as LLMRun;
    llmRun.end_time = Date.now();
    llmRun.response = output;
    await this._endTrace(llmRun);
  }

  async handleLLMError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    const llmRun = run as LLMRun;
    llmRun.end_time = Date.now();
    llmRun.error = error.message;
    await this._endTrace(llmRun);
  }

  async handleChainStart(
    chain: { name: string },
    inputs: ChainValues,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: ChainRun = {
      uuid: runId,
      parent_uuid: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: chain,
      inputs,
      session_id: this.session.id,
      execution_order: this.executionOrder,
      type: "chain",
      child_llm_runs: [],
      child_chain_runs: [],
      child_tool_runs: [],
    };

    this._startTrace(run);
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "chain") {
      throw new Error("No chain run to end.");
    }
    const chainRun = run as ChainRun;
    chainRun.end_time = Date.now();
    chainRun.outputs = outputs;
    await this._endTrace(chainRun);
  }

  async handleChainError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "chain") {
      throw new Error("No chain run to end.");
    }
    const chainRun = run as ChainRun;
    chainRun.end_time = Date.now();
    chainRun.error = error.message;
    await this._endTrace(chainRun);
  }

  async handleToolStart(
    tool: { name: string },
    input: string,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: ToolRun = {
      uuid: runId,
      parent_uuid: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: tool,
      tool_input: input,
      session_id: this.session.id,
      execution_order: this.executionOrder,
      type: "tool",
      action: JSON.stringify(tool), // TODO: this is duplicate info, not needed
      child_llm_runs: [],
      child_chain_runs: [],
      child_tool_runs: [],
    };

    this._startTrace(run);
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "tool") {
      throw new Error("No tool run to end");
    }
    const toolRun = run as ToolRun;
    toolRun.end_time = Date.now();
    toolRun.output = output;
    await this._endTrace(toolRun);
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "tool") {
      throw new Error("No tool run to end");
    }
    const toolRun = run as ToolRun;
    toolRun.end_time = Date.now();
    toolRun.error = error.message;
    await this._endTrace(toolRun);
  }
}

export class LangChainTracer extends BaseTracer {
  name = "langchain_tracer";

  protected endpoint =
    (typeof process !== "undefined"
      ? // eslint-disable-next-line no-process-env
        process.env?.LANGCHAIN_ENDPOINT
      : undefined) || "http://localhost:8000";

  protected headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  constructor() {
    super();
    // eslint-disable-next-line no-process-env
    if (typeof process !== "undefined" && process.env?.LANGCHAIN_API_KEY) {
      // eslint-disable-next-line no-process-env
      this.headers["x-api-key"] = process.env?.LANGCHAIN_API_KEY;
    }
  }

  protected async persistRun(run: LLMRun | ChainRun | ToolRun): Promise<void> {
    let endpoint;
    if (run.type === "llm") {
      endpoint = `${this.endpoint}/llm-runs`;
    } else if (run.type === "chain") {
      endpoint = `${this.endpoint}/chain-runs`;
    } else {
      endpoint = `${this.endpoint}/tool-runs`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(run),
    });
    if (!response.ok) {
      console.error(
        `Failed to persist run: ${response.status} ${response.statusText}`
      );
    }
  }

  protected async persistSession(
    sessionCreate: TracerSessionCreate
  ): Promise<TracerSession> {
    const endpoint = `${this.endpoint}/sessions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(sessionCreate),
    });
    if (!response.ok) {
      console.error(
        `Failed to persist session: ${response.status} ${response.statusText}, using default session.`
      );
      return {
        id: 1,
        ...sessionCreate,
      };
    }
    return {
      id: (await response.json()).id,
      ...sessionCreate,
    };
  }

  async loadSession(sessionName: string): Promise<TracerSession> {
    const endpoint = `${this.endpoint}/sessions?name=${sessionName}`;
    return this._handleSessionResponse(endpoint);
  }

  async loadDefaultSession(): Promise<TracerSession> {
    const endpoint = `${this.endpoint}/sessions?name=default`;
    return this._handleSessionResponse(endpoint);
  }

  private async _handleSessionResponse(endpoint: string) {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: this.headers,
    });
    let tracerSession: TracerSession;
    if (!response.ok) {
      console.error(
        `Failed to load session: ${response.status} ${response.statusText}`
      );
      tracerSession = {
        id: 1,
        start_time: Date.now(),
      };
      this.session = tracerSession;
      return tracerSession;
    }
    const resp = (await response.json()) as TracerSession[];
    if (resp.length === 0) {
      tracerSession = {
        id: 1,
        start_time: Date.now(),
      };
      this.session = tracerSession;
      return tracerSession;
    }
    [tracerSession] = resp;
    this.session = tracerSession;
    return tracerSession;
  }

  copy(): LangChainTracer {
    // TODO: this is a hack to get tracing to work with the current backend
    // we need to not use execution order, then remove this check
    if (this.executionOrder === 1) {
      const copy = new LangChainTracer();
      copy.session = this.session;
      copy.runMap = new Map(this.runMap);
      copy.executionOrder = this.executionOrder;
      return copy;
    }
    return this;
  }
}
