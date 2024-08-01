import type { z } from "zod";
import type { IterableReadableStreamInterface } from "../utils/stream.js";
import type { SerializableInterface } from "../load/serializable.js";
import type { BaseCallbackConfig } from "../callbacks/manager.js";

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
  data: RunnableIOSchema | RunnableInterface;
}

export interface RunnableConfig extends BaseCallbackConfig {
  /**
   * Runtime values for attributes previously made configurable on this Runnable,
   * or sub-Runnables.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configurable?: Record<string, any>;

  /**
   * Maximum number of times a call can recurse. If not provided, defaults to 25.
   */
  recursionLimit?: number;

  /** Maximum number of parallel calls to make. */
  maxConcurrency?: number;
}
