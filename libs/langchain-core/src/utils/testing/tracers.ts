import { BaseTracer, Run } from "../../tracers/base.js";

export class SingleRunExtractor extends BaseTracer {
  runPromiseResolver: (run: Run) => void;

  runPromise: Promise<Run>;

  /** The name of the callback handler. */
  name = "single_run_extractor";

  constructor() {
    super();
    this.runPromise = new Promise<Run>((extract) => {
      this.runPromiseResolver = extract;
    });
  }

  async persistRun(run: Run) {
    this.runPromiseResolver(run);
  }

  async extract(): Promise<Run> {
    return this.runPromise;
  }
}
