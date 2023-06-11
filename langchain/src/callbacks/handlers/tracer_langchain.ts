import { LangChainPlusClient } from "langchainplus-sdk";
import { Run, RunCreate, RunUpdate } from "langchainplus-sdk/schemas";
import {
  getEnvironmentVariable,
  getRuntimeEnvironment,
} from "../../util/env.js";
import { BaseTracer } from "./tracer.js";

export interface LangChainTracerFields {
  exampleId?: string;
  sessionName?: string;
  client?: LangChainPlusClient;
}

export class LangChainTracer
  extends BaseTracer
  implements LangChainTracerFields
{
  name = "langchain_tracer";

  sessionName?: string;

  exampleId?: string;

  client: LangChainPlusClient;

  constructor({ exampleId, sessionName, client }: LangChainTracerFields = {}) {
    super();

    this.sessionName =
      sessionName ?? getEnvironmentVariable("LANGCHAIN_SESSION");
    this.exampleId = exampleId;
    this.client = client ?? new LangChainPlusClient({});
  }

  private async _convertToCreate(
    run: Run,
    example_id: string | undefined = undefined
  ): Promise<RunCreate> {
    const runExtra = run.extra ?? {};
    runExtra.runtime = await getRuntimeEnvironment();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { child_runs: _, ...restOfRun } = run;
    restOfRun.extra = runExtra;
    restOfRun.reference_example_id = restOfRun.parent_run_id
      ? undefined
      : example_id;
    return { child_runs: [], session_name: this.sessionName, ...restOfRun };
  }

  protected async persistRun(_run: Run): Promise<void> {}

  protected async _persistRunSingle(run: Run): Promise<void> {
    const persistedRun: RunCreate = await this._convertToCreate(
      run,
      this.exampleId
    );
    await this.client.createRun(persistedRun);
  }

  protected async _updateRunSingle(run: Run): Promise<void> {
    const runUpdate: RunUpdate = {
      end_time: run.end_time,
      error: run.error,
      outputs: run.outputs,
      parent_run_id: run.parent_run_id,
      reference_example_id: run.reference_example_id,
    };
    await this.client.updateRun(run.id, runUpdate);
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
