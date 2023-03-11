import * as process from "process";
import { LLMResult } from "../../schema/index.js";
import { ChainValues } from "../../chains/index.js";
import { BaseCallbackHandler } from "../index.js";

export type RunType = "llm" | "chain" | "tool";

export interface BaseTracerSession {
  startTime: number;
  name?: string;
}

export type TracerSessionCreate = BaseTracerSession;

export interface TracerSession extends BaseTracerSession {
  id: number;
}

export interface BaseRun {
  id?: number;
  startTime: number;
  endTime: number;
  executionOrder: number;
  serialized: { name: string };
  sessionId: number;
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
  childLLMRuns: LLMRun[];
  childChainRuns: ChainRun[];
  childToolRuns: ToolRun[];
}

export interface ToolRun extends BaseRun {
  toolInput: string;
  output?: string;
  action: string;
  childLLMRuns: LLMRun[];
  childChainRuns: ChainRun[];
  childToolRuns: ToolRun[];
}

export abstract class BaseTracer extends BaseCallbackHandler {
  protected session?: TracerSession;

  protected stack: (LLMRun | ChainRun | ToolRun)[] = [];

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
      startTime: Date.now(),
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
      parentRun.childLLMRuns.push(childRun as LLMRun);
    } else if (childRun.type === "chain") {
      parentRun.childChainRuns.push(childRun as ChainRun);
    } else if (childRun.type === "tool") {
      parentRun.childToolRuns.push(childRun as ToolRun);
    } else {
      throw new Error("Invalid run type");
    }
  }

  protected _startTrace(run: LLMRun | ChainRun | ToolRun) {
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
    this.stack.push(run);
  }

  protected async _endTrace() {
    const run = this.stack.pop();
    if (this.stack.length === 0 && run) {
      this.executionOrder = 1;
      await this.persistRun(run);
    }
  }

  async handleLLMStart(
    llm: { name: string },
    prompts: string[],
    _verbose?: boolean
  ): Promise<void> {
    if (this.session === undefined) {
      throw new Error("Initialize a session before starting a trace.");
    }
    const run: LLMRun = {
      startTime: Date.now(),
      endTime: 0,
      serialized: llm,
      prompts,
      sessionId: this.session.id,
      executionOrder: this.executionOrder,
      type: "llm",
    };

    this._startTrace(run);
  }

  async handleLLMEnd(output: LLMResult, _verbose?: boolean): Promise<void> {
    if (this.stack.length === 0 || this.stack.at(-1)?.type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    const run = this.stack.at(-1) as LLMRun;
    run.endTime = Date.now();
    run.response = output;
    await this._endTrace();
  }

  async handleLLMError(error: Error, _verbose?: boolean): Promise<void> {
    if (this.stack.length === 0 || this.stack.at(-1)?.type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    const run = this.stack.at(-1) as LLMRun;
    run.endTime = Date.now();
    run.error = error.message;
    await this._endTrace();
  }

  async handleChainStart(
    chain: { name: string },
    inputs: ChainValues,
    _verbose?: boolean
  ): Promise<void> {
    if (this.session === undefined) {
      throw new Error("Initialize a session before starting a trace.");
    }
    const run: ChainRun = {
      startTime: Date.now(),
      endTime: 0,
      serialized: chain,
      inputs,
      sessionId: this.session.id,
      executionOrder: this.executionOrder,
      type: "chain",
      childLLMRuns: [],
      childChainRuns: [],
      childToolRuns: [],
    };

    this._startTrace(run);
  }

  async handleChainEnd(
    outputs: ChainValues,
    _verbose?: boolean
  ): Promise<void> {
    if (this.stack.length === 0 || this.stack.at(-1)?.type !== "chain") {
      throw new Error("No chain run to end.");
    }
    const run = this.stack.at(-1) as ChainRun;
    run.endTime = Date.now();
    run.outputs = outputs;
    await this._endTrace();
  }

  async handleChainError(error: Error, _verbose?: boolean): Promise<void> {
    if (this.stack.length === 0 || this.stack.at(-1)?.type !== "chain") {
      throw new Error("No chain run to end.");
    }
    const run = this.stack.at(-1) as ChainRun;
    run.endTime = Date.now();
    run.error = error.message;
    await this._endTrace();
  }

  async handleToolStart(
    tool: { name: string },
    input: string,
    _verbose?: boolean
  ): Promise<void> {
    if (this.session === undefined) {
      throw new Error("Initialize a session before starting a trace.");
    }
    const run: ToolRun = {
      startTime: Date.now(),
      endTime: 0,
      serialized: tool,
      toolInput: input,
      sessionId: this.session.id,
      executionOrder: this.executionOrder,
      type: "tool",
      action: JSON.stringify(tool), // TODO: this is duplicate info, not needed
      childLLMRuns: [],
      childChainRuns: [],
      childToolRuns: [],
    };

    this._startTrace(run);
  }

  async handleToolEnd(output: string, _verbose?: boolean): Promise<void> {
    if (this.stack.length === 0 || this.stack.at(-1)?.type !== "tool") {
      throw new Error("No tool run to end");
    }
    const run = this.stack.at(-1) as ToolRun;
    run.endTime = Date.now();
    run.output = output;
    await this._endTrace();
  }

  async handleToolError(error: Error, _verbose?: boolean): Promise<void> {
    if (this.stack.length === 0 || this.stack.at(-1)?.type !== "tool") {
      throw new Error("No tool run to end.");
    }
    const run = this.stack.at(-1) as ToolRun;
    run.endTime = Date.now();
    run.error = error.message;
    await this._endTrace();
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
        startTime: Date.now(),
      };
      this.session = tracerSession;
      return tracerSession;
    }
    const resp = (await response.json()) as TracerSession[];
    if (resp.length === 0) {
      tracerSession = {
        id: 1,
        startTime: Date.now(),
      };
      this.session = tracerSession;
      return tracerSession;
    }
    [tracerSession] = resp;
    this.session = tracerSession;
    return tracerSession;
  }
}
