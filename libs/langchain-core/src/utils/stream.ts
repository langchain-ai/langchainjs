import { pickRunnableConfigKeys } from "../runnables/config.js";
import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";
import type { IterableReadableStreamInterface } from "../types/_internal.js";
import { raceWithSignal } from "./signal.js";

// Re-exported for backwards compatibility
// Do NOT import this type from this file inside the project. Instead, always import from `types/_internal.js`
// when using internally
export type { IterableReadableStreamInterface };

/*
 * Support async iterator syntax for ReadableStreams in all environments.
 * Source: https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 */
export class IterableReadableStream<T>
  extends ReadableStream<T>
  implements IterableReadableStreamInterface<T>
{
  public reader: ReadableStreamDefaultReader<T>;

  ensureReader() {
    if (!this.reader) {
      this.reader = this.getReader();
    }
  }

  async next(): Promise<IteratorResult<T>> {
    this.ensureReader();
    try {
      const result = await this.reader.read();
      if (result.done) {
        this.reader.releaseLock(); // release lock when stream becomes closed
        return {
          done: true,
          value: undefined,
        };
      } else {
        return {
          done: false,
          value: result.value,
        };
      }
    } catch (e) {
      this.reader.releaseLock(); // release lock when stream becomes errored
      throw e;
    }
  }

  async return(): Promise<IteratorResult<T>> {
    this.ensureReader();
    // If wrapped in a Node stream, cancel is already called.
    if (this.locked) {
      const cancelPromise = this.reader.cancel(); // cancel first, but don't await yet
      this.reader.releaseLock(); // release lock first
      await cancelPromise; // now await it
    }
    return { done: true, value: undefined };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async throw(e: any): Promise<IteratorResult<T>> {
    this.ensureReader();
    if (this.locked) {
      const cancelPromise = this.reader.cancel(); // cancel first, but don't await yet
      this.reader.releaseLock(); // release lock first
      await cancelPromise; // now await it
    }
    throw e;
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Not present in Node 18 types, required in latest Node 22
  async [Symbol.asyncDispose]() {
    await this.return();
  }

  static fromReadableStream<T>(stream: ReadableStream<T>) {
    // From https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams#reading_the_stream
    const reader = stream.getReader();
    return new IterableReadableStream<T>({
      start(controller) {
        return pump();
        function pump(): Promise<T | undefined> {
          return reader.read().then(({ done, value }) => {
            // When no more data needs to be consumed, close the stream
            if (done) {
              controller.close();
              return;
            }
            // Enqueue the next data chunk into our target stream
            controller.enqueue(value);
            return pump();
          });
        }
      },
      cancel() {
        reader.releaseLock();
      },
    });
  }

  static fromAsyncGenerator<T>(generator: AsyncGenerator<T>) {
    return new IterableReadableStream<T>({
      async pull(controller) {
        const { value, done } = await generator.next();
        // When no more data needs to be consumed, close the stream
        if (done) {
          controller.close();
        }
        // Fix: `else if (value)` will hang the streaming when nullish value (e.g. empty string) is pulled
        controller.enqueue(value);
      },
      async cancel(reason) {
        await generator.return(reason);
      },
    });
  }
}

export function atee<T>(
  iter: AsyncGenerator<T>,
  length = 2
): AsyncGenerator<T>[] {
  const buffers = Array.from(
    { length },
    () => [] as Array<IteratorResult<T> | IteratorReturnResult<T>>
  );
  return buffers.map(async function* makeIter(buffer) {
    while (true) {
      if (buffer.length === 0) {
        const result = await iter.next();
        for (const buffer of buffers) {
          buffer.push(result);
        }
      } else if (buffer[0].done) {
        return;
      } else {
        yield buffer.shift()!.value;
      }
    }
  });
}

export function concat<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Array<any> | string | number | Record<string, any> | any
>(first: T, second: T): T {
  if (Array.isArray(first) && Array.isArray(second)) {
    return first.concat(second) as T;
  } else if (typeof first === "string" && typeof second === "string") {
    return (first + second) as T;
  } else if (typeof first === "number" && typeof second === "number") {
    return (first + second) as T;
  } else if (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "concat" in (first as any) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (first as any).concat === "function"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (first as any).concat(second) as T;
  } else if (typeof first === "object" && typeof second === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunk = { ...first } as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [key, value] of Object.entries(second as Record<string, any>)) {
      if (key in chunk && !Array.isArray(chunk[key])) {
        chunk[key] = concat(chunk[key], value);
      } else {
        chunk[key] = value;
      }
    }
    return chunk as T;
  } else {
    throw new Error(`Cannot concat ${typeof first} and ${typeof second}`);
  }
}

export class AsyncGeneratorWithSetup<
  S = unknown,
  T = unknown,
  TReturn = unknown,
  TNext = unknown
> implements AsyncGenerator<T, TReturn, TNext>
{
  private generator: AsyncGenerator<T>;

  public setup: Promise<S>;

  public config?: unknown;

  public signal?: AbortSignal;

  private firstResult: Promise<IteratorResult<T>>;

  private firstResultUsed = false;

  /**
   * Streaming inactivity timeout in milliseconds.
   * If set, the stream will be aborted if no new chunk is received within this time period.
   */
  private streamTimeoutMs?: number;

  /**
   * AbortController for the stream timeout.
   * This is used to abort the stream when the inactivity timeout expires.
   */
  private streamTimeoutController?: AbortController;

  /**
   * Current timeout ID for the stream inactivity timeout.
   */
  private streamTimeoutId?: ReturnType<typeof setTimeout>;

  /**
   * Combined signal that includes both the original signal and the stream timeout signal.
   */
  private combinedSignal?: AbortSignal;

  constructor(params: {
    generator: AsyncGenerator<T>;
    startSetup?: () => Promise<S>;
    config?: unknown;
    signal?: AbortSignal;
  }) {
    this.generator = params.generator;
    this.config = params.config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.signal = params.signal ?? (this.config as any)?.signal;

    // Extract streamTimeoutMs from config metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configAny = this.config as any;
    this.streamTimeoutMs = configAny?.metadata?.streamTimeoutMs;

    // If streamTimeout is set, create an AbortController for it
    if (this.streamTimeoutMs !== undefined && this.streamTimeoutMs > 0) {
      this.streamTimeoutController = new AbortController();
      // Combine with existing signal if present
      if (this.signal) {
        if ("any" in AbortSignal) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.combinedSignal = (AbortSignal as any).any([
            this.signal,
            this.streamTimeoutController.signal,
          ]);
        } else {
          // Fallback for older Node versions - just use stream timeout signal
          // and manually check original signal
          this.combinedSignal = this.streamTimeoutController.signal;
        }
      } else {
        this.combinedSignal = this.streamTimeoutController.signal;
      }
      // Start the initial timeout
      this._resetStreamTimeout();
    } else {
      this.combinedSignal = this.signal;
    }

    // setup is a promise that resolves only after the first iterator value
    // is available. this is useful when setup of several piped generators
    // needs to happen in logical order, ie. in the order in which input to
    // to each generator is available.
    this.setup = new Promise((resolve, reject) => {
      // eslint-disable-next-line no-void
      void AsyncLocalStorageProviderSingleton.runWithConfig(
        pickRunnableConfigKeys(
          params.config as Record<string, unknown> | undefined
        ),
        async () => {
          this.firstResult = params.generator.next();
          if (params.startSetup) {
            this.firstResult.then(params.startSetup).then(resolve, reject);
          } else {
            this.firstResult.then((_result) => resolve(undefined as S), reject);
          }
        },
        true
      );
    });
  }

  /**
   * Reset the stream inactivity timeout.
   * This should be called each time a new chunk is received.
   */
  private _resetStreamTimeout(): void {
    if (this.streamTimeoutMs === undefined || !this.streamTimeoutController) {
      return;
    }
    // Clear existing timeout
    if (this.streamTimeoutId !== undefined) {
      clearTimeout(this.streamTimeoutId);
    }
    // Set new timeout
    this.streamTimeoutId = setTimeout(() => {
      this.streamTimeoutController?.abort(
        new Error(
          `Stream timeout: No chunks received for ${this.streamTimeoutMs}ms`
        )
      );
    }, this.streamTimeoutMs);
  }

  /**
   * Clear the stream inactivity timeout.
   * This should be called when the stream completes or is aborted.
   */
  private _clearStreamTimeout(): void {
    if (this.streamTimeoutId !== undefined) {
      clearTimeout(this.streamTimeoutId);
      this.streamTimeoutId = undefined;
    }
  }

  async next(...args: [] | [TNext]): Promise<IteratorResult<T>> {
    // Check the combined signal (includes stream timeout)
    this.combinedSignal?.throwIfAborted();
    // Also check original signal for fallback in older Node versions
    this.signal?.throwIfAborted();

    if (!this.firstResultUsed) {
      this.firstResultUsed = true;
      const result = await this.firstResult;
      if (!result.done) {
        // Reset the stream timeout on successful chunk
        this._resetStreamTimeout();
      } else {
        // Clear timeout when stream is done
        this._clearStreamTimeout();
      }
      return result;
    }

    const effectiveSignal = this.combinedSignal ?? this.signal;

    const result = await AsyncLocalStorageProviderSingleton.runWithConfig(
      pickRunnableConfigKeys(
        this.config as Record<string, unknown> | undefined
      ),
      effectiveSignal
        ? async () => {
            return raceWithSignal(
              this.generator.next(...args),
              effectiveSignal
            );
          }
        : async () => {
            return this.generator.next(...args);
          },
      true
    );

    if (!result.done) {
      // Reset the stream timeout on successful chunk
      this._resetStreamTimeout();
    } else {
      // Clear timeout when stream is done
      this._clearStreamTimeout();
    }

    return result;
  }

  async return(
    value?: TReturn | PromiseLike<TReturn>
  ): Promise<IteratorResult<T>> {
    this._clearStreamTimeout();
    return this.generator.return(value);
  }

  async throw(e: Error): Promise<IteratorResult<T>> {
    this._clearStreamTimeout();
    return this.generator.throw(e);
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Not present in Node 18 types, required in latest Node 22
  async [Symbol.asyncDispose]() {
    await this.return();
  }
}

export async function pipeGeneratorWithSetup<
  S,
  A extends unknown[],
  T,
  TReturn,
  TNext,
  U,
  UReturn,
  UNext
>(
  to: (
    g: AsyncGenerator<T, TReturn, TNext>,
    s: S,
    ...args: A
  ) => AsyncGenerator<U, UReturn, UNext>,
  generator: AsyncGenerator<T, TReturn, TNext>,
  startSetup: () => Promise<S>,
  signal: AbortSignal | undefined,
  ...args: A
) {
  const gen = new AsyncGeneratorWithSetup({
    generator,
    startSetup,
    signal,
  });
  const setup = await gen.setup;
  return { output: to(gen, setup, ...args), setup };
}
