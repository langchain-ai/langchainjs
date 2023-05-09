import * as uuid from "uuid";
import {
  AgentAction,
  ChainValues,
  LLMResult,
  RUN_KEY,
  RunInputs,
  RunOutputs,
} from "../../schema/index.js";
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

export interface BaseTracerSessionV2 extends BaseTracerSession {
  tenant_id: string; // uuid
}

export interface TracerSessionCreateV2 extends BaseTracerSessionV2 {
  id?: string; // uuid. Auto-generated if not provided
}

export interface TracerSessionV2 extends BaseTracerSessionV2 {
  id: string; // uuid
}

export interface BaseRun {
  uuid: string;
  parent_uuid?: string;
  start_time: number;
  end_time: number;
  execution_order: number;
  child_execution_order: number;
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

export interface AgentRun extends ChainRun {
  actions: AgentAction[];
}

export interface ToolRun extends BaseRun {
  tool_input: string;
  output?: string;
  action: string;
  child_llm_runs: LLMRun[];
  child_chain_runs: ChainRun[];
  child_tool_runs: ToolRun[];
}

export type Run = LLMRun | ChainRun | ToolRun;

export interface RunV2Base {
  id: string;
  start_time: number;
  end_time: number;
  extra: object;
  error?: string;
  execution_order: number;
  serialized: object;
  inputs: RunInputs;
  outputs: RunOutputs;
  session_id: string; // uuid
  reference_example_id?: string; // uuid
  run_type: RunType;
}

export interface RunV2Create extends RunV2Base {
  name?: string; // uuid if not provided
  child_runs?: RunV2Create[];
}

export interface RunV2 extends RunV2Base {
  name: string;
  parent_run_id?: string; // uuid
}

export abstract class BaseTracer extends BaseCallbackHandler {
  protected session?: TracerSession | TracerSessionV2;

  protected runMap: Map<string, Run> = new Map();

  protected constructor() {
    super();
  }

  copy(): this {
    return this;
  }

  abstract loadSession(
    sessionName: string
  ): Promise<TracerSession | TracerSessionV2>;

  abstract loadDefaultSession(): Promise<TracerSession | TracerSessionV2>;

  protected abstract persistRun(run: Run): Promise<void>;

  protected abstract persistSession(
    session: BaseTracerSession
  ): Promise<TracerSession | TracerSessionV2>;

  async newSession(
    sessionName?: string
  ): Promise<TracerSession | TracerSessionV2> {
    const sessionCreate: TracerSessionCreate = {
      start_time: Date.now(),
      name: sessionName,
    };
    const session = await this.persistSession(sessionCreate);
    this.session = session;
    return session;
  }

  protected _addChildRun(parentRun: ChainRun | ToolRun, childRun: Run) {
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

  protected _startTrace(run: Run) {
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

  protected async _endTrace(run: Run): Promise<void> {
    if (!run.parent_uuid) {
      await this.persistRun(run);
    } else {
      const parentRun = this.runMap.get(run.parent_uuid);

      if (parentRun === undefined) {
        throw new Error(`Parent run ${run.parent_uuid} not found`);
      }

      parentRun.child_execution_order = Math.max(
        parentRun.child_execution_order,
        run.child_execution_order
      );
    }
    this.runMap.delete(run.uuid);
  }

  protected _getExecutionOrder(parentRunId: string | undefined): number {
    // If a run has no parent then execution order is 1
    if (parentRunId === undefined) {
      return 1;
    }

    const parentRun = this.runMap.get(parentRunId);

    if (parentRun === undefined) {
      throw new Error(`Parent run ${parentRunId} not found`);
    }

    return parentRun.child_execution_order + 1;
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
    const execution_order = this._getExecutionOrder(parentRunId);
    const session = this.session as TracerSession;
    const run: LLMRun = {
      uuid: runId,
      parent_uuid: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: llm,
      prompts,
      session_id: session.id,
      execution_order,
      child_execution_order: execution_order,
      type: "llm",
    };

    this._startTrace(run);
    await this.onLLMStart?.(run);
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "llm") {
      throw new Error("No LLM run to end.");
    }
    const llmRun = run as LLMRun;
    llmRun.end_time = Date.now();
    llmRun.response = output;
    await this.onLLMEnd?.(llmRun);
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
    await this.onLLMError?.(llmRun);
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
    const session = this.session as TracerSession;
    const execution_order = this._getExecutionOrder(parentRunId);
    const run: ChainRun = {
      uuid: runId,
      parent_uuid: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: chain,
      inputs,
      session_id: session.id,
      execution_order,
      child_execution_order: execution_order,
      type: "chain",
      child_llm_runs: [],
      child_chain_runs: [],
      child_tool_runs: [],
    };

    this._startTrace(run);
    await this.onChainStart?.(run);
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "chain") {
      throw new Error("No chain run to end.");
    }
    const chainRun = run as ChainRun;
    chainRun.end_time = Date.now();
    chainRun.outputs = outputs;
    await this.onChainEnd?.(chainRun);
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
    await this.onChainError?.(chainRun);
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
    const session = this.session as TracerSession;
    const execution_order = this._getExecutionOrder(parentRunId);
    const run: ToolRun = {
      uuid: runId,
      parent_uuid: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: tool,
      tool_input: input,
      session_id: session.id,
      execution_order,
      child_execution_order: execution_order,
      type: "tool",
      action: JSON.stringify(tool), // TODO: this is duplicate info, not needed
      child_llm_runs: [],
      child_chain_runs: [],
      child_tool_runs: [],
    };

    this._startTrace(run);
    await this.onToolStart?.(run);
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "tool") {
      throw new Error("No tool run to end");
    }
    const toolRun = run as ToolRun;
    toolRun.end_time = Date.now();
    toolRun.output = output;
    await this.onToolEnd?.(toolRun);
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
    await this.onToolError?.(toolRun);
    await this._endTrace(toolRun);
  }

  async handleAgentAction(action: AgentAction, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.type !== "chain") {
      return;
    }
    const agentRun = run as AgentRun;
    agentRun.actions = agentRun.actions || [];
    agentRun.actions.push(action);
    await this.onAgentAction?.(run as AgentRun);
  }

  // custom event handlers

  onLLMStart?(run: LLMRun): void | Promise<void>;

  onLLMEnd?(run: LLMRun): void | Promise<void>;

  onLLMError?(run: LLMRun): void | Promise<void>;

  onChainStart?(run: ChainRun): void | Promise<void>;

  onChainEnd?(run: ChainRun): void | Promise<void>;

  onChainError?(run: ChainRun): void | Promise<void>;

  onToolStart?(run: ToolRun): void | Promise<void>;

  onToolEnd?(run: ToolRun): void | Promise<void>;

  onToolError?(run: ToolRun): void | Promise<void>;

  onAgentAction?(run: AgentRun): void | Promise<void>;

  // TODO Implement handleAgentEnd, handleText

  // onAgentEnd?(run: ChainRun): void | Promise<void>;

  // onText?(run: Run): void | Promise<void>;
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
    sessionCreate: BaseTracerSession
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

  async loadSession(
    sessionName: string
  ): Promise<TracerSession | TracerSessionV2> {
    const endpoint = `${this.endpoint}/sessions?name=${sessionName}`;
    return this._handleSessionResponse(endpoint);
  }

  async loadDefaultSession(): Promise<TracerSession | TracerSessionV2> {
    const endpoint = `${this.endpoint}/sessions?name=default`;
    return this._handleSessionResponse(endpoint);
  }

  protected async _handleSessionResponse(
    endpoint: string
  ): Promise<TracerSession | TracerSessionV2> {
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

export class LangChainTracerV2 extends LangChainTracer {
  exampleId?: string;

  tenantId?: string;

  constructor(exampleId?: string, tenantId?: string) {
    super();
    this.tenantId =
      tenantId ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.LANGCHAIN_TENANT_ID
        : undefined);
    this.exampleId = exampleId;
  }

  async updateTenantId(): Promise<string> {
    const endpoint = `${this.endpoint}/tenants`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch tenant ID: ${response.status} ${response.statusText}`
      );
    }

    const tenants = await response.json();
    if (!tenants || tenants.length === 0) {
      throw new Error(`No tenants found for endpoint ${endpoint}`);
    }

    const tenantId = tenants[0].id;
    this.tenantId = tenantId;
    return tenantId;
  }

  protected async _handleSessionResponse(
    endpoint: string
  ): Promise<TracerSession | TracerSessionV2> {
    const tenantId = this.tenantId ?? (await this.updateTenantId());
    const configured_endpoint = `${endpoint}&tenant_id=${this.tenantId}`;
    const response = await fetch(configured_endpoint, {
      method: "GET",
      headers: this.headers,
    });
    let tracerSession: TracerSessionV2;
    if (!response.ok) {
      console.error(
        `Failed to load session: ${response.status} ${response.statusText}`
      );
      tracerSession = {
        id: uuid.v4(),
        start_time: Date.now(),
        tenant_id: tenantId,
      };
      this.session = tracerSession;
      return tracerSession;
    }
    const resp = (await response.json()) as TracerSessionV2[];
    if (resp.length === 0) {
      tracerSession = {
        id: uuid.v4(),
        start_time: Date.now(),
        tenant_id: tenantId,
      };
      this.session = tracerSession;
      return tracerSession;
    }
    [tracerSession] = resp;
    this.session = tracerSession;
    return tracerSession;
  }

  protected async convertRunToV2Run(
    run: LLMRun | ChainRun | ToolRun
  ): Promise<RunV2Create> {
    const session = (this.session ??
      this.loadDefaultSession()) as TracerSessionV2;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inputs: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let outputs: Record<string, any> | null = null;
    let child_runs: Array<LLMRun | ChainRun | ToolRun> = [];
    if (run.type === "llm") {
      const llmRun = run as LLMRun;
      inputs = { prompts: llmRun.prompts };
      outputs = llmRun.response
        ? {
            generations: llmRun.response.generations,
            llmOutput: llmRun.response.llmOutput,
            [RUN_KEY]: llmRun.response[RUN_KEY],
          }
        : {};
      child_runs = [];
    } else if (run.type === "chain") {
      const chainRun = run as ChainRun;
      inputs = chainRun.inputs;
      outputs = chainRun.outputs ?? {};
      child_runs = [
        ...chainRun.child_llm_runs,
        ...chainRun.child_chain_runs,
        ...chainRun.child_tool_runs,
      ];
    } else if (run.type === "tool") {
      const toolRun = run as ToolRun;
      inputs = { input: toolRun.tool_input };
      outputs = toolRun.output ? { output: toolRun.output } : {};
      child_runs = [
        ...toolRun.child_llm_runs,
        ...toolRun.child_chain_runs,
        ...toolRun.child_tool_runs,
      ];
    } else {
      throw new Error(`Unknown run type: ${run.type}`);
    }

    return {
      id: run.uuid,
      name: run.serialized.name,
      start_time: run.start_time,
      end_time: run.end_time,
      extra: {}, // TODO: VWP
      error: run.error,
      execution_order: run.execution_order,
      serialized: run.serialized,
      inputs,
      outputs,
      session_id: session.id,
      run_type: run.type,
      child_runs: await Promise.all(
        child_runs.map((child) => this.convertRunToV2Run(child))
      ),
    };
  }

  protected async persistRun(run: LLMRun | ChainRun | ToolRun): Promise<void> {
    const runV2 = await this.convertRunToV2Run(run);
    runV2.reference_example_id = this.exampleId;
    const endpoint = `${this.endpoint}/runs`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(runV2),
    });
    if (!response.ok) {
      console.error(
        `Failed to persist run: ${response.status} ${response.statusText}`
      );
    }
  }
}
