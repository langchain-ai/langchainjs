import { v4 as uuidv4 } from "uuid";
import { ChainValues, LLMResult } from "../schema/index.js";
import { BaseCallbackHandler, RunId } from "./base.js";

export const TRACER_RUN_ID = "run_id";

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
  id: RunId;
  start_time: number;
  end_time: number;
  execution_order: number;
  serialized: { name: string };
  session_id: number;
  error?: string;
  caller_id?: RunId;
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

  protected runMap: Map<RunId, LLMRun | ChainRun | ToolRun> = new Map();

  protected executionOrder = 1;

  protected constructor() {
    super();
    this.alwaysVerbose = true;
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

    if (run.caller_id) {
      const callerRun = this.runMap.get(run.caller_id);
      if (callerRun) {
        if (!(callerRun.type === "tool" || callerRun.type === "chain")) {
          throw new Error("Caller run can only be a tool or chain");
        } else {
          this._addChildRun(callerRun as ChainRun | ToolRun, run);
        }
      } else {
        throw new Error(`Caller run ${run.caller_id} not found`);
      }
    }
  }

  protected async _endTrace(run: LLMRun | ChainRun | ToolRun): Promise<void> {
    if (run.caller_id === undefined) {
      await this.persistRun(run);
    }
    this.runMap.delete(run.id);
  }

  async handleLLMStart(
    llm: { name: string },
    prompts: string[],
    callerId?: RunId
  ): Promise<Record<string, RunId>> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: LLMRun = {
      id: uuidv4(),
      start_time: Date.now(),
      end_time: 0,
      serialized: llm,
      prompts,
      session_id: this.session.id,
      execution_order: this.executionOrder,
      caller_id: callerId,
      type: "llm",
    };

    this._startTrace(run);
    return { TRACER_RUN_ID: run.id };
  }

  async handleLLMEnd(output: LLMResult, runId: RunId): Promise<void> {
    if (
      this.runMap.get(runId)?.type !== "llm" ||
      this.runMap.get(runId) === undefined
    ) {
      throw new Error("No LLM run to end.");
    }
    const run = this.runMap.get(runId) as LLMRun;
    run.end_time = Date.now();
    run.response = output;
    await this._endTrace(run);
  }

  async handleLLMError(error: Error, runId: RunId): Promise<void> {
    if (
      this.runMap.get(runId)?.type !== "llm" ||
      this.runMap.get(runId) === undefined
    ) {
      throw new Error("No LLM run to end.");
    }
    const run = this.runMap.get(runId) as LLMRun;
    run.end_time = Date.now();
    run.error = error.message;
    await this._endTrace(run);
  }

  async handleChainStart(
    chain: { name: string },
    inputs: ChainValues,
    callerId?: RunId
  ): Promise<Record<string, RunId>> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: ChainRun = {
      id: uuidv4(),
      caller_id: callerId,
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
    return { TRACER_RUN_ID: run.id };
  }

  async handleChainEnd(outputs: ChainValues, runId: RunId): Promise<void> {
    if (
      this.runMap.get(runId)?.type !== "chain" ||
      this.runMap.get(runId) === undefined
    ) {
      throw new Error("No chain run to end.");
    }
    const run = this.runMap.get(runId) as ChainRun;
    run.end_time = Date.now();
    run.outputs = outputs;
    await this._endTrace(run);
  }

  async handleChainError(error: Error, runId: RunId): Promise<void> {
    if (
      this.runMap.get(runId)?.type !== "chain" ||
      this.runMap.get(runId) === undefined
    ) {
      throw new Error("No chain run to end.");
    }
    const run = this.runMap.get(runId) as ChainRun;
    run.end_time = Date.now();
    run.error = error.message;
    await this._endTrace(run);
  }

  async handleToolStart(
    tool: { name: string },
    input: string,
    callerId?: RunId
  ): Promise<Record<string, RunId>> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: ToolRun = {
      id: uuidv4(),
      caller_id: callerId,
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
    return { TRACER_RUN_ID: run.id };
  }

  async handleToolEnd(output: string, runId: RunId): Promise<void> {
    if (
      this.runMap.get(runId)?.type !== "tool" ||
      this.runMap.get(runId) === undefined
    ) {
      throw new Error("No tool run to end.");
    }
    const run = this.runMap.get(runId) as ToolRun;
    run.end_time = Date.now();
    run.output = output;
    await this._endTrace(run);
  }

  async handleToolError(error: Error, runId: RunId): Promise<void> {
    if (
      this.runMap.get(runId)?.type !== "tool" ||
      this.runMap.get(runId) === undefined
    ) {
      throw new Error("No tool run to end.");
    }
    const run = this.runMap.get(runId) as ToolRun;
    run.end_time = Date.now();
    run.error = error.message;
    await this._endTrace(run);
  }
}

export class LangChainTracer extends BaseTracer {
  protected endpoint =
    process.env.LANGCHAIN_ENDPOINT || "http://localhost:8000";

  protected headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  constructor() {
    super();
    if (process.env.LANGCHAIN_API_KEY) {
      this.headers["x-api-key"] = process.env.LANGCHAIN_API_KEY;
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
}
