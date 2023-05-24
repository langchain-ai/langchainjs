import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";
import {
  getEnvironmentVariable,
  getRuntimeEnvironment,
} from "../../util/env.js";
import { BaseTracer, Run, BaseRun } from "./tracer.js";

export interface RunCreate extends BaseRun {
  child_runs: this[];
  session_name?: string;
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
      reference_example_id: example_id,
      extra: runExtra,
      execution_order: run.execution_order,
      serialized: run.serialized,
      error: run.error,
      inputs: run.inputs,
      outputs: run.outputs ?? {},
      session_name: this.sessionName,
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
    const response = await this.caller.call(fetch, endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(persistedRun),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to persist run: ${response.status} ${response.statusText} ${body}`
      );
    }
  }
}
