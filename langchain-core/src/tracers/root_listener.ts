import { RunnableConfig } from "../runnables/config.js";
import { BaseTracer, Run } from "./base.js";

export class RootListenersTracer extends BaseTracer {
  name = "RootListenersTracer";

  /** The Run's ID. Type UUID */
  rootId?: string;

  config: RunnableConfig;

  argOnStart?: (run: Run, config: RunnableConfig) => void | Promise<void>;

  argOnEnd?: (run: Run, config: RunnableConfig) => void | Promise<void>;

  argOnError?: (run: Run, config: RunnableConfig) => void | Promise<void>;

  constructor({
    config,
    onStart,
    onEnd,
    onError,
  }: {
    config: RunnableConfig;
    onStart?: (run: Run, config: RunnableConfig) => void | Promise<void>;
    onEnd?: (run: Run, config: RunnableConfig) => void | Promise<void>;
    onError?: (run: Run, config: RunnableConfig) => void | Promise<void>;
  }) {
    super({ _awaitHandler: true });
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
      await this.argOnStart(run, this.config);
    }
  }

  async onRunUpdate(run: Run) {
    if (run.id !== this.rootId) {
      return;
    }
    if (!run.error) {
      if (this.argOnEnd) {
        await this.argOnEnd(run, this.config);
      }
    } else if (this.argOnError) {
      await this.argOnError(run, this.config);
    }
  }
}
