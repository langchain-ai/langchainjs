import { BaseTracer, Run } from "./base.js";

export class RootListenersTracer extends BaseTracer {
  name = "RootListenersTracer";

  /** The Run's ID. Type UUID */
  rootId?: string;

  argOnStart?: (run: Run) => void;

  argOnEnd?: (run: Run) => void;

  argOnError?: (run: Run) => void;

  constructor({
    onStart,
    onEnd,
    onError,
  }: {
    onStart?: (run: Run) => void;
    onEnd?: (run: Run) => void;
    onError?: (run: Run) => void;
  }) {
    super();
    this.argOnStart = onStart;
    this.argOnEnd = onEnd;
    this.argOnError = onError;
  }

  /**
   * This is a legacy method only called once for an entire run tree
   * therefore not useful here
   * @param {Run} _ Not used
   */
  persistRun(_: Run): Promise<void> {
    return Promise.resolve();
  }

  onRunCreate(run: Run) {
    if (this.rootId) {
      return;
    }

    this.rootId = run.id;

    if (this.argOnStart) {
      this.argOnStart(run);
    }
  }

  onRunUpdate(run: Run) {
    if (run.id !== this.rootId) {
      return;
    }
    if (!run.error) {
      if (this.argOnEnd) {
        this.argOnEnd(run);
      }
    } else if (this.argOnError) {
      this.argOnError(run);
    }
  }
}
