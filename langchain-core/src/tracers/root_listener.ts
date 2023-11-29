import { BaseTracer, Run } from "./base.js";

export class RootListenersTracer extends BaseTracer {
  name = "RootListenersTracer";

  /** The Run's ID. Type UUID */
  rootId?: string;

  argOnStart?: (run: Run) => void | Promise<void>;

  argOnEnd?: (run: Run) => void | Promise<void>;

  argOnError?: (run: Run) => void | Promise<void>;

  constructor({
    onStart,
    onEnd,
    onError,
  }: {
    onStart?: (run: Run) => void | Promise<void>;
    onEnd?: (run: Run) => void | Promise<void>;
    onError?: (run: Run) => void | Promise<void>;
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

  async onRunCreate(run: Run) {
    if (this.rootId) {
      return;
    }

    this.rootId = run.id;

    if (this.argOnStart) {
      await this.argOnStart(run);
    }
  }

  async onRunUpdate(run: Run) {
    if (run.id !== this.rootId) {
      return;
    }
    if (!run.error) {
      if (this.argOnEnd) {
        await this.argOnEnd(run);
      }
    } else if (this.argOnError) {
      await this.argOnError(run);
    }
  }
}
