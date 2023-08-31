import { BaseRun } from "langsmith/schemas";
import { BaseTracer } from "./tracer.js";

export class RunCollectorCallbackHandler extends BaseTracer {
  name = "run_collector";

  exampleId?: string;

  tracedRuns: BaseRun[];

  constructor({ exampleId }: { exampleId?: string } = {}) {
    super();
    this.exampleId = exampleId;
    this.tracedRuns = [];
  }

  protected async persistRun(run: BaseRun): Promise<void> {
    const run_ = { ...run };
    run_.reference_example_id = this.exampleId;
    this.tracedRuns.push(run_);
  }
}
