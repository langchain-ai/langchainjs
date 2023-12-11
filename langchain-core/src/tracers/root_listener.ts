import { RunnableConfig } from "../runnables/config.js";
import { BaseTracer, Run } from "./base.js";

export class RootListenersTracer extends BaseTracer {
  name = "RootListenersTracer";

  /** The Run's ID. Type UUID */
  rootId?: string;

  config: RunnableConfig;

  argOnStart?: {
    (run: Run): void | Promise<void>;
    (run: Run, config: RunnableConfig): void | Promise<void>;
  };

  argOnEnd?: {
    (run: Run): void | Promise<void>;
    (run: Run, config: RunnableConfig): void | Promise<void>;
  };

  argOnError?: {
    (run: Run): void | Promise<void>;
    (run: Run, config: RunnableConfig): void | Promise<void>;
  };

  constructor({
    config,
    onStart,
    onEnd,
    onError,
  }: {
    config: RunnableConfig;
    onStart?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onEnd?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
    onError?: (run: Run, config?: RunnableConfig) => void | Promise<void>;
  }) {
    super();
    this.config = config;
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
      if (this.argOnStart.length === 1) {
        await this.argOnStart(run);
      } else if (this.argOnStart.length === 2) {
        await this.argOnStart(run, this.config);
      }
    }
  }

  async onRunUpdate(run: Run) {
    if (run.id !== this.rootId) {
      return;
    }
    if (!run.error) {
      if (this.argOnEnd) {
        if (this.argOnEnd.length === 1) {
          await this.argOnEnd(run);
        } else if (this.argOnEnd.length === 2) {
          await this.argOnEnd(run, this.config);
        }
      }
    } else if (this.argOnError) {
      if (this.argOnError.length === 1) {
        await this.argOnError(run);
      } else if (this.argOnError.length === 2) {
        await this.argOnError(run, this.config);
      }
    }
  }
}
