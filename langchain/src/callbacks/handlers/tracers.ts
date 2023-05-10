import * as uuid from "uuid";
import {
  AgentAction,
  ChainValues,
  LLMResult,
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

export interface BaseRunV2 {
  id: string;
  name: string;
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

export interface RunV2Create extends BaseRunV2 {
  child_runs: RunV2Create[];
}
export interface RunV2 extends RunV2Create {
  child_execution_order: number;
  child_runs: RunV2[];
  parent_run_id?: string; // uuid
}

export interface AgentRunV2 extends RunV2 {
  actions: AgentAction[];
}

export abstract class BaseTracer extends BaseCallbackHandler {
  protected session?: TracerSession | TracerSessionV2;

  protected runMap: Map<string, RunV2> = new Map();

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

  protected abstract persistRun(run: RunV2): Promise<void>;

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

  protected _addChildRun(parentRun: RunV2, childRun: RunV2) {
    parentRun.child_runs.push(childRun);
  }

  protected _startTrace(run: RunV2) {
    if (run.parent_run_id !== undefined) {
      const parentRun = this.runMap.get(run.parent_run_id);
      if (parentRun) {
        this._addChildRun(parentRun, run);
      } else {
        throw new Error(`Caller run ${run.parent_run_id} not found`);
      }
    }
    this.runMap.set(run.id, run);
  }

  protected async _endTrace(run: RunV2): Promise<void> {
    if (!run.parent_run_id) {
      await this.persistRun(run);
    } else {
      const parentRun = this.runMap.get(run.parent_run_id);

      if (parentRun === undefined) {
        throw new Error(`Parent run ${run.parent_run_id} not found`);
      }

      parentRun.child_execution_order = Math.max(
        parentRun.child_execution_order,
        run.child_execution_order
      );
    }
    this.runMap.delete(run.id);
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
    const session = this.session as TracerSessionV2;
    const run: RunV2 = {
      id: runId,
      name: llm.name,
      extra: {},
      parent_run_id: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: llm,
      inputs: { prompts },
      outputs: {},
      session_id: session.id,
      execution_order,
      child_runs: [],
      child_execution_order: execution_order,
      run_type: "llm",
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
    await this.onLLMError?.(run);
    await this._endTrace(run);
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
    const session = this.session as TracerSessionV2;
    const execution_order = this._getExecutionOrder(parentRunId);
    const run: RunV2 = {
      id: runId,
      name: chain.name,
      parent_run_id: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: chain,
      inputs,
      session_id: session.id,
      execution_order,
      child_execution_order: execution_order,
      run_type: "chain",
      child_runs: [],
      extra: {},
      outputs: {},
    };

    this._startTrace(run);
    await this.onChainStart?.(run);
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      throw new Error("No chain run to end.");
    }
    run.end_time = Date.now();
    run.outputs = outputs;
    await this.onChainEnd?.(run);
    await this._endTrace(run);
  }

  async handleChainError(error: Error, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      throw new Error("No chain run to end.");
    }
    run.end_time = Date.now();
    run.error = error.message;
    await this.onChainError?.(run);
    await this._endTrace(run);
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
    const session = this.session as TracerSessionV2;
    const execution_order = this._getExecutionOrder(parentRunId);
    const run: RunV2 = {
      id: runId,
      name: tool.name,
      parent_run_id: parentRunId,
      start_time: Date.now(),
      end_time: 0,
      serialized: tool,
      inputs: { input },
      outputs: {},
      session_id: session.id,
      execution_order,
      child_execution_order: execution_order,
      run_type: "tool",
      child_runs: [],
      extra: {},
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
    await this.onToolError?.(run);
    await this._endTrace(run);
  }

  async handleAgentAction(action: AgentAction, runId: string): Promise<void> {
    const run = this.runMap.get(runId);
    if (!run || run?.run_type !== "chain") {
      return;
    }
    const agentRun = run as AgentRunV2;
    agentRun.actions = agentRun.actions || [];
    agentRun.actions.push(action);
    await this.onAgentAction?.(run as AgentRunV2);
  }

  // custom event handlers

  onLLMStart?(run: RunV2): void | Promise<void>;

  onLLMEnd?(run: RunV2): void | Promise<void>;

  onLLMError?(run: RunV2): void | Promise<void>;

  onChainStart?(run: RunV2): void | Promise<void>;

  onChainEnd?(run: RunV2): void | Promise<void>;

  onChainError?(run: RunV2): void | Promise<void>;

  onToolStart?(run: RunV2): void | Promise<void>;

  onToolEnd?(run: RunV2): void | Promise<void>;

  onToolError?(run: RunV2): void | Promise<void>;

  onAgentAction?(run: RunV2): void | Promise<void>;

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

  protected async convertV2RunToRun(
    run: RunV2
  ): Promise<LLMRun | ChainRun | ToolRun> {
    const session = (this.session ??
      this.loadDefaultSession()) as TracerSession;

    const serialized = run.serialized as { name: string };
    let runResult: LLMRun | ChainRun | ToolRun;
    if (run.run_type === "llm") {
      const llmRun: LLMRun = {
        uuid: run.id,
        start_time: run.start_time,
        end_time: run.end_time,
        execution_order: run.execution_order,
        child_execution_order: run.child_execution_order,
        serialized,
        type: run.run_type,
        session_id: session.id,
        prompts: run.inputs.prompts,
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
        output: run.outputs.output,
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
    run: RunV2 | LLMRun | ChainRun | ToolRun
  ): Promise<void> {
    let endpoint;
    let v1Run: LLMRun | ChainRun | ToolRun;
    if ((run as RunV2).run_type !== undefined) {
      v1Run = await this.convertV2RunToRun(run as RunV2);
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
    sessionCreate: BaseTracerSession | BaseTracerSessionV2
  ): Promise<TracerSession | TracerSessionV2> {
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

  protected async persistSession(
    sessionCreate: BaseTracerSessionV2 | BaseTracerSession
  ): Promise<TracerSession | TracerSessionV2> {
    const endpoint = `${this.endpoint}/sessions`;
    const tenant_id = this.tenantId ?? (await this.updateTenantId());
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(sessionCreate),
    });
    if (!response.ok) {
      if (sessionCreate.name !== undefined) {
        try {
          return await this.loadSession(sessionCreate.name);
        } catch (e) {
          console.error(
            `Failed to load session: ${response.status} ${response.statusText}.`
          );
        }
      }
      console.error(
        `Failed to persist session: ${response.status} ${response.statusText}, using default session.`
      );
      return {
        id: uuid.v4(),
        tenant_id,
        ...sessionCreate,
      };
    }
    return {
      id: (await response.json()).id,
      tenant_id,
      ...sessionCreate,
    };
  }

  async newSession(sessionName?: string): Promise<TracerSessionV2> {
    const tenantId = this.tenantId ?? (await this.updateTenantId());
    const sessionCreate: TracerSessionCreateV2 = {
      start_time: Date.now(),
      name: sessionName,
      tenant_id: tenantId,
    };
    const session = await this.persistSession(sessionCreate);
    this.session = session;
    return session as TracerSessionV2;
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

  private async _convertToCreate(
    run: RunV2,
    example_id: string | undefined = undefined
  ): Promise<RunV2Create> {
    const persistedRun: RunV2Create = {
      id: run.id,
      name: run.name,
      start_time: run.start_time,
      end_time: run.end_time,
      run_type: run.run_type,
      reference_example_id: example_id,
      extra: run.extra,
      execution_order: run.execution_order,
      serialized: run.serialized,
      error: run.error,
      inputs: run.inputs,
      outputs: run.outputs,
      session_id: run.session_id,
      child_runs: await Promise.all(
        run.child_runs.map((child_run) => this._convertToCreate(child_run))
      ),
    };
    return persistedRun;
  }

  protected async persistRun(run: RunV2): Promise<void> {
    const persistedRun: RunV2Create = await this._convertToCreate(
      run,
      this.exampleId
    );
    const endpoint = `${this.endpoint}/runs`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(persistedRun),
    });
    if (!response.ok) {
      console.error(
        `Failed to persist run: ${response.status} ${response.statusText}`
      );
    }
  }
}
