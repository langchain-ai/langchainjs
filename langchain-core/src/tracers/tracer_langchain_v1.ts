import type { ChainValues } from "../utils/types.js";
import { type BaseMessage, getBufferString } from "../messages/index.js";
import type { LLMResult } from "../outputs.js";
import { getEnvironmentVariable } from "../utils/env.js";

import { BaseTracer, type RunType, type Run } from "./base.js";

export interface BaseRunV1 {
  uuid: string;
  parent_uuid?: string;
  start_time: number;
  end_time?: number;
  execution_order: number;
  child_execution_order: number;
  serialized: { name: string };
  session_id: number;
  error?: string;
  type: RunType;
}

export interface LLMRun extends BaseRunV1 {
  prompts: string[];
  response?: LLMResult;
}

export interface ChainRun extends BaseRunV1 {
  inputs: ChainValues;
  outputs?: ChainValues;
  child_llm_runs: LLMRun[];
  child_chain_runs: ChainRun[];
  child_tool_runs: ToolRun[];
}

export interface ToolRun extends BaseRunV1 {
  tool_input: string;
  output?: string;
  action: string;
  child_llm_runs: LLMRun[];
  child_chain_runs: ChainRun[];
  child_tool_runs: ToolRun[];
}

export interface BaseTracerSession {
  start_time: number;
  name?: string;
}

export type TracerSessionCreate = BaseTracerSession;

export interface TracerSessionV1 extends BaseTracerSession {
  id: number;
}

export class LangChainTracerV1 extends BaseTracer {
  name = "langchain_tracer";

  protected endpoint =
    getEnvironmentVariable("LANGCHAIN_ENDPOINT") || "http://localhost:1984";

  protected headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  protected session: TracerSessionV1;

  constructor() {
    super();
    const apiKey = getEnvironmentVariable("LANGCHAIN_API_KEY");
    if (apiKey) {
      this.headers["x-api-key"] = apiKey;
    }
  }

  async newSession(sessionName?: string): Promise<TracerSessionV1> {
    const sessionCreate: TracerSessionCreate = {
      start_time: Date.now(),
      name: sessionName,
    };
    const session = await this.persistSession(sessionCreate);
    this.session = session;
    return session;
  }

  async loadSession(sessionName: string): Promise<TracerSessionV1> {
    const endpoint = `${this.endpoint}/sessions?name=${sessionName}`;
    return this._handleSessionResponse(endpoint);
  }

  async loadDefaultSession(): Promise<TracerSessionV1> {
    const endpoint = `${this.endpoint}/sessions?name=default`;
    return this._handleSessionResponse(endpoint);
  }

  protected async convertV2RunToRun(
    run: Run
  ): Promise<LLMRun | ChainRun | ToolRun> {
    const session = this.session ?? (await this.loadDefaultSession());
    const serialized = run.serialized as { name: string };
    let runResult: LLMRun | ChainRun | ToolRun;
    if (run.run_type === "llm") {
      const prompts: string[] = run.inputs.prompts
        ? run.inputs.prompts
        : (run.inputs.messages as BaseMessage[][]).map((x) =>
            getBufferString(x)
          );

      const llmRun: LLMRun = {
        uuid: run.id,
        start_time: run.start_time,
        end_time: run.end_time,
        execution_order: run.execution_order,
        child_execution_order: run.child_execution_order,
        serialized,
        type: run.run_type,
        session_id: session.id,
        prompts,
        response: run.outputs as LLMResult,
      };
      runResult = llmRun;
    } else if (run.run_type === "chain") {
      const child_runs = await Promise.all(
        run.child_runs.map((child_run) => this.convertV2RunToRun(child_run))
      );
      const chainRun: ChainRun = {
        uuid: run.id,
        start_time: run.start_time,
        end_time: run.end_time,
        execution_order: run.execution_order,
        child_execution_order: run.child_execution_order,
        serialized,
        type: run.run_type,
        session_id: session.id,
        inputs: run.inputs,
        outputs: run.outputs,
        child_llm_runs: child_runs.filter(
          (child_run) => child_run.type === "llm"
        ) as LLMRun[],
        child_chain_runs: child_runs.filter(
          (child_run) => child_run.type === "chain"
        ) as ChainRun[],
        child_tool_runs: child_runs.filter(
          (child_run) => child_run.type === "tool"
        ) as ToolRun[],
      };

      runResult = chainRun;
    } else if (run.run_type === "tool") {
      const child_runs = await Promise.all(
        run.child_runs.map((child_run) => this.convertV2RunToRun(child_run))
      );
      const toolRun: ToolRun = {
        uuid: run.id,
        start_time: run.start_time,
        end_time: run.end_time,
        execution_order: run.execution_order,
        child_execution_order: run.child_execution_order,
        serialized,
        type: run.run_type,
        session_id: session.id,
        tool_input: run.inputs.input,
        output: run.outputs?.output,
        action: JSON.stringify(serialized),
        child_llm_runs: child_runs.filter(
          (child_run) => child_run.type === "llm"
        ) as LLMRun[],
        child_chain_runs: child_runs.filter(
          (child_run) => child_run.type === "chain"
        ) as ChainRun[],
        child_tool_runs: child_runs.filter(
          (child_run) => child_run.type === "tool"
        ) as ToolRun[],
      };

      runResult = toolRun;
    } else {
      throw new Error(`Unknown run type: ${run.run_type}`);
    }
    return runResult;
  }

  protected async persistRun(
    run: Run | LLMRun | ChainRun | ToolRun
  ): Promise<void> {
    let endpoint;
    let v1Run: LLMRun | ChainRun | ToolRun;
    if ((run as Run).run_type !== undefined) {
      v1Run = await this.convertV2RunToRun(run as Run);
    } else {
      v1Run = run as LLMRun | ChainRun | ToolRun;
    }
    if (v1Run.type === "llm") {
      endpoint = `${this.endpoint}/llm-runs`;
    } else if (v1Run.type === "chain") {
      endpoint = `${this.endpoint}/chain-runs`;
    } else {
      endpoint = `${this.endpoint}/tool-runs`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(v1Run),
    });
    if (!response.ok) {
      console.error(
        `Failed to persist run: ${response.status} ${response.statusText}`
      );
    }
  }

  protected async persistSession(
    sessionCreate: BaseTracerSession
  ): Promise<TracerSessionV1> {
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

  protected async _handleSessionResponse(
    endpoint: string
  ): Promise<TracerSessionV1> {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: this.headers,
    });
    let tracerSession: TracerSessionV1;
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
    const resp = (await response.json()) as TracerSessionV1[];
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
