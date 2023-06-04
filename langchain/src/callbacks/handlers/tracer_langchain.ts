import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";
import {
  getEnvironmentVariable,
  getRuntimeEnvironment,
} from "../../util/env.js";
import { BaseTracer, Run, BaseRun } from "./tracer.js";
import { RunOutputs } from "../../schema/index.js";

export interface RunCreate extends BaseRun {
  parent_run_id?: string; // uuid
  child_runs: this[];
  session_name?: string;
}

export interface RunUpdate {
  end_time?: number;
  error?: string;
  outputs?: RunOutputs;
  parent_run_id?: string; // uuid
  reference_example_id?: string; // uuid
}

export interface LangChainTracerFields {
  exampleId?: string;
  sessionName?: string;
  callerParams?: AsyncCallerParams;
  timeout?: number;
}

export class LangChainTracer
  extends BaseTracer
  implements LangChainTracerFields
{
  name = "langchain_tracer";

  protected endpoint =
    getEnvironmentVariable("LANGCHAIN_ENDPOINT") || "http://localhost:1984";

  protected headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  sessionName?: string;

  exampleId?: string;

  caller: AsyncCaller;

  timeout = 5000;

  constructor({
    exampleId,
    sessionName,
    callerParams,
    timeout,
  }: LangChainTracerFields = {}) {
    super();

    const apiKey = getEnvironmentVariable("LANGCHAIN_API_KEY");
    if (apiKey) {
      this.headers["x-api-key"] = apiKey;
    }

    this.sessionName =
      sessionName ?? getEnvironmentVariable("LANGCHAIN_SESSION");
    this.exampleId = exampleId;
    this.timeout = timeout ?? this.timeout;
    this.caller = new AsyncCaller(callerParams ?? { maxRetries: 2 });
  }

  private async _convertToCreate(
    run: Run,
    example_id: string | undefined = undefined
  ): Promise<RunCreate> {
    const runExtra = run.extra ?? {};
    runExtra.runtime = await getRuntimeEnvironment();
    const persistedRun: RunCreate = {
      id: run.id,
      name: run.name,
      start_time: run.start_time,
      end_time: run.end_time,
      run_type: run.run_type,
      // example_id is only set for the root run
      reference_example_id: run.parent_run_id ? undefined : example_id,
      extra: runExtra,
      parent_run_id: run.parent_run_id,
      execution_order: run.execution_order,
      serialized: run.serialized,
      error: run.error,
      inputs: run.inputs,
      outputs: run.outputs ?? {},
      session_name: this.sessionName,
      child_runs: [],
    };
    return persistedRun;
  }

  protected async persistRun(_run: Run): Promise<void> {}

  protected async _persistRunSingle(run: Run): Promise<void> {
    const persistedRun: RunCreate = await this._convertToCreate(
      run,
      this.exampleId
    );
    const endpoint = `${this.endpoint}/runs`;
    const response = await this.caller.call(fetch, endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(persistedRun),
      signal: AbortSignal.timeout(this.timeout),
    });
    // consume the response body to release the connection
    // https://undici.nodejs.org/#/?id=garbage-collection
    const body = await response.text();
    if (!response.ok) {
      throw new Error(
        `Failed to persist run: ${response.status} ${response.statusText} ${body}`
      );
    }
  }

  protected async _updateRunSingle(run: Run): Promise<void> {
    const runUpdate: RunUpdate = {
      end_time: run.end_time,
      error: run.error,
      outputs: run.outputs,
      parent_run_id: run.parent_run_id,
      reference_example_id: run.reference_example_id,
    };
    const endpoint = `${this.endpoint}/runs/${run.id}`;
    const response = await this.caller.call(fetch, endpoint, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(runUpdate),
      signal: AbortSignal.timeout(this.timeout),
    });
    // consume the response body to release the connection
    // https://undici.nodejs.org/#/?id=garbage-collection
    const body = await response.text();
    if (!response.ok) {
      throw new Error(
        `Failed to update run: ${response.status} ${response.statusText} ${body}`
      );
    }
  }

  async onLLMStart(run: Run): Promise<void> {
    await this._persistRunSingle(run);
  }

  async onLLMEnd(run: Run): Promise<void> {
    await this._updateRunSingle(run);
  }

  async onLLMError(run: Run): Promise<void> {
    await this._updateRunSingle(run);
  }

  async onChainStart(run: Run): Promise<void> {
    await this._persistRunSingle(run);
  }

  async onChainEnd(run: Run): Promise<void> {
    await this._updateRunSingle(run);
  }

  async onChainError(run: Run): Promise<void> {
    await this._updateRunSingle(run);
  }

  async onToolStart(run: Run): Promise<void> {
    await this._persistRunSingle(run);
  }

  async onToolEnd(run: Run): Promise<void> {
    await this._updateRunSingle(run);
  }

  async onToolError(run: Run): Promise<void> {
    await this._updateRunSingle(run);
  }
}
