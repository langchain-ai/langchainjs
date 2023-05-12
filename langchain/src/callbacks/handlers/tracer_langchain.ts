import * as uuid from "uuid";

import { BaseTracer, Run, BaseRun } from "./tracer.js";
import { Optional } from "../../types/type-utils.js";

export interface RunCreate extends BaseRun {
  child_runs: this[];
  session_id: string; // uuid
}

export interface BaseTracerSession {
  start_time: number;
  name?: string;
}

export interface BaseTracerSessionV2 extends BaseTracerSession {
  tenant_id: string; // uuid
}

export interface TracerSessionCreateV2 extends BaseTracerSessionV2 {
  id?: string; // uuid. Auto-generated if not provided
}

export interface TracerSession extends BaseTracerSessionV2 {
  id: string; // uuid
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

  protected session: TracerSession;

  exampleId?: string;

  tenantId?: string;

  constructor(exampleId?: string, tenantId?: string) {
    super();

    // eslint-disable-next-line no-process-env
    if (typeof process !== "undefined" && process.env?.LANGCHAIN_API_KEY) {
      // eslint-disable-next-line no-process-env
      this.headers["x-api-key"] = process.env?.LANGCHAIN_API_KEY;
    }

    this.tenantId =
      tenantId ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.LANGCHAIN_TENANT_ID
        : undefined);
    this.exampleId = exampleId;
  }

  async newSession(sessionName?: string): Promise<TracerSession> {
    const tenantId = this.tenantId ?? (await this.updateTenantId());
    const sessionCreate: TracerSessionCreateV2 = {
      start_time: Date.now(),
      name: sessionName,
      tenant_id: tenantId,
    };
    const session = await this.persistSession(sessionCreate);
    this.session = session;
    return session as TracerSession;
  }

  async loadSession(sessionName: string): Promise<TracerSession> {
    const endpoint = `${this.endpoint}/sessions?name=${sessionName}`;
    return this._handleSessionResponse(endpoint);
  }

  async loadDefaultSession(): Promise<TracerSession> {
    const endpoint = `${this.endpoint}/sessions?name=default`;
    return this._handleSessionResponse(endpoint);
  }

  protected async persistSession(
    sessionCreate: Optional<BaseTracerSessionV2, "tenant_id">
  ): Promise<TracerSession> {
    const endpoint = `${this.endpoint}/sessions`;
    const tenant_id = this.tenantId ?? (await this.updateTenantId());
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(sessionCreate),
    });
    if (!response.ok) {
      if (sessionCreate.name !== undefined) {
        return await this.loadSession(sessionCreate.name);
      } else {
        return await this.loadDefaultSession();
      }
    }
    return {
      id: (await response.json()).id,
      tenant_id,
      ...sessionCreate,
    };
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
  ): Promise<TracerSession> {
    const tenantId = this.tenantId ?? (await this.updateTenantId());
    const configured_endpoint = `${endpoint}&tenant_id=${this.tenantId}`;
    const response = await fetch(configured_endpoint, {
      method: "GET",
      headers: this.headers,
    });
    let tracerSession: TracerSession;
    if (!response.ok) {
      throw new Error(
        `Failed to fetch session: ${response.status} ${response.statusText}`
      );
    }
    const resp = (await response.json()) as TracerSession[];
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
    run: Run,
    example_id: string | undefined = undefined
  ): Promise<RunCreate> {
    const session = this.session ?? (await this.loadDefaultSession());
    const persistedRun: RunCreate = {
      id: run.id,
      name: run.name,
      start_time: run.start_time,
      end_time: run.end_time,
      run_type: run.run_type,
      reference_example_id: example_id,
      extra: run.extra ?? {},
      execution_order: run.execution_order,
      serialized: run.serialized,
      error: run.error,
      inputs: run.inputs,
      outputs: run.outputs ?? {},
      session_id: session.id,
      child_runs: await Promise.all(
        run.child_runs.map((child_run) => this._convertToCreate(child_run))
      ),
    };
    return persistedRun;
  }

  protected async persistRun(run: Run): Promise<void> {
    const persistedRun: RunCreate = await this._convertToCreate(
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
