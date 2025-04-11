import type { z } from "zod";
import type { SerializableInterface } from "../load/serializable.js";
import type { BaseCallbackConfig } from "../callbacks/manager.js";
import type { IterableReadableStreamInterface } from "../types/_internal.js";

export type RunnableBatchOptions = {
  /** @deprecated Pass in via the standard runnable config object instead */
  maxConcurrency?: number;
  returnExceptions?: boolean;
};

export type RunnableIOSchema = {
  name?: string;
  schema: z.ZodType;
};

/**
 * Base interface implemented by all runnables.
 * Used for cross-compatibility between different versions of LangChain core.
 *
 * Should not change on patch releases.
 */
export interface RunnableInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any,
  CallOptions extends RunnableConfig = RunnableConfig
> extends SerializableInterface {
  lc_serializable: boolean;

  invoke(input: RunInput, options?: Partial<CallOptions>): Promise<RunOutput>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  stream(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<IterableReadableStreamInterface<RunOutput>>;

  transform(
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput>;

  getName(suffix?: string): string;
}

export interface Edge {
  source: string;
  target: string;
  data?: string;
  conditional?: boolean;
}

export interface Node {
  id: string;
  name: string;
  data: RunnableIOSchema | RunnableInterface;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Controls how the Runnable execution runtime responds to abort signals, including timeouts.
 */
export const OrchestratorAbortBehavior = {
  /**
   * The orchestrator will immediately throw on abort or timeout, abandoning any in-progress tasks.
   * This is the default behavior of LangChain core.
   */
  THROW_IMMEDIATELY: "throw_immediately" as const,

  /**
   * Allow in-progress tasks to complete normally on abort or timeout, but throw if new tasks would
   * start (including retries). In this mode, no promises are abandoned, so it is up to the task
   * implementations to honor the abort signal for cancellations and timeout behavior to work as
   * expected.
   *
   * This is the default behavior for LangGraph workflows. How this effects chains in LangChain will
   * depend on the type of chain being executed. For streaming chains that work as a pipeline, this
   * will behave identically to the {@link OrchestratorAbortBehavior.PASSTHROUGH} behavior. For
   * chains that run sequentially, this will work as described in the paragraph above.
   */
  COMPLETE_PENDING: "complete_pending" as const,

  /**
   * Delegates abort handling completely to the tasks themselves. The execution layer will never
   * throw due to an abort signal.
   */
  PASSTHROUGH: "passthrough" as const,
};

export type OrchestratorAbortBehavior =
  (typeof OrchestratorAbortBehavior)[keyof typeof OrchestratorAbortBehavior];

export interface RunnableConfig<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ConfigurableFieldType extends Record<string, any> = Record<string, any>
> extends BaseCallbackConfig {
  /**
   * Runtime values for attributes previously made configurable on this Runnable,
   * or sub-Runnables.
   */
  configurable?: ConfigurableFieldType;

  /**
   * Maximum number of times a call can recurse. If not provided, defaults to 25.
   */
  recursionLimit?: number;

  /** Maximum number of parallel calls to make. */
  maxConcurrency?: number;

  /**
   * Timeout for this call in milliseconds.
   */
  timeout?: number;

  /**
   * Abort signal for this call.
   * If provided, the call will be aborted when the signal is aborted.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
   */
  signal?: AbortSignal;

  /**
   * Controls how the execution runtime responds to abort signals. This applies to both explicit
   * aborts via AbortSignal and to implicit aborts, such as timeouts.
   *
   * This setting only affects Runnable orchestration behavior. Service implementations (like
   * {@link ChatOpenAI}) should always cancel their operations and throw on abort, and they
   * should do so without abandoning asynchronous operations that cannot be forcibly canceled.
   *
   * Default behavior depends on the orchestrator being used:
   *
   * - For chains in LangChain, this defaults to {@link OrchestratorAbortBehavior.THROW_IMMEDIATELY}
   * - For LangGraph workflows, this defaults to {@link OrchestratorAbortBehavior.COMPLETE_PENDING}
   */
  orchestratorAbortBehavior?: OrchestratorAbortBehavior;
}
