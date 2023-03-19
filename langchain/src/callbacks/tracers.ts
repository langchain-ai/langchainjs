import { ChainValues, LLMResult } from "../schema/index.js";
import { BaseCallbackHandler } from "./base.js";

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
  id?: number;
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

  protected stack: (LLMRun | ChainRun | ToolRun)[] = [];

  protected runMap: Map<string, LLMRun | ChainRun | ToolRun> = new Map();

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

  protected _startTrace(runId: string, run: LLMRun | ChainRun | ToolRun) {
    this.executionOrder += 1;

    if (this.stack.length > 0) {
      if (
        !(
          this.stack.at(-1)?.type === "tool" ||
          this.stack.at(-1)?.type === "chain"
        )
      ) {
        throw new Error("Nested run can only be logged for tool or chain");
      }
      const parentRun = this.stack.at(-1) as ChainRun | ToolRun;
      this._addChildRun(parentRun, run);
    }
    this.runMap.set(runId, run);
    this.stack.push(run);
  }

  protected async _endTrace(runId: string) {
    const run = this.runMap.get(runId);
    this.stack.pop();
    if (this.stack.length === 0 && run) {
      this.executionOrder = 1;
      await this.persistRun(run);
    }
  }

  async handleLLMStart(
    llm: { name: string },
    prompts: string[],
    runId: string
  ): Promise<void> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: LLMRun = {
      start_time: Date.now(),
      end_time: 0,
      serialized: llm,
      prompts,
      session_id: this.session.id,
      execution_order: this.executionOrder,
      type: "llm",
    };

    this._startTrace(runId, run);
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    const llmRun = run as LLMRun;
    llmRun.end_time = Date.now();
    llmRun.response = output;
    await this._endTrace(runId);
  }

  async handleLLMError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    const llmRun = run as LLMRun;
    llmRun.end_time = Date.now();
    llmRun.error = error.message;
    await this._endTrace(runId);
  }

  async handleChainStart(
    chain: { name: string },
    inputs: ChainValues,
    runId: string
  ): Promise<void> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: ChainRun = {
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

    this._startTrace(runId, run);
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "chain") {
      throw new Error("No chain run to end.");
    }
    const chainRun = run as ChainRun;
    chainRun.end_time = Date.now();
    chainRun.outputs = outputs;
    await this._endTrace(runId);
  }

  async handleChainError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "chain") {
      throw new Error("No chain run to end.");
    }
    const chainRun = run as ChainRun;
    chainRun.end_time = Date.now();
    chainRun.error = error.message;
    await this._endTrace(runId);
  }

  async handleToolStart(
    tool: { name: string },
    input: string,
    runId: string
  ): Promise<void> {
    if (this.session === undefined) {
      this.session = await this.loadDefaultSession();
    }
    const run: ToolRun = {
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

    this._startTrace(runId, run);
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "tool") {
      throw new Error("No tool run to end");
    }
    const toolRun = run as ToolRun;
    toolRun.end_time = Date.now();
    toolRun.output = output;
    await this._endTrace(runId);
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "tool") {
      throw new Error("No tool run to end");
    }
    const toolRun = run as ToolRun;
    toolRun.end_time = Date.now();
    toolRun.error = error.message;
    await this._endTrace(runId);
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
