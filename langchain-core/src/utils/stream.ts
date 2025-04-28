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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    // setup is a promise that resolves only after the first iterator value
    // is available. this is useful when setup of several piped generators
    // needs to happen in logical order, ie. in the order in which input to
    // to each generator is available.
    this.setup = new Promise((resolve, reject) => {
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

  async next(...args: [] | [TNext]): Promise<IteratorResult<T>> {
    this.signal?.throwIfAborted();

    if (!this.firstResultUsed) {
      this.firstResultUsed = true;
      return this.firstResult;
    }

    return AsyncLocalStorageProviderSingleton.runWithConfig(
      pickRunnableConfigKeys(
        this.config as Record<string, unknown> | undefined
      ),
      this.signal
        ? async () => {
            return raceWithSignal(this.generator.next(...args), this.signal);
          }
        : async () => {
            return this.generator.next(...args);
          },
      true
    );
  }

  async return(
    value?: TReturn | PromiseLike<TReturn>
  ): Promise<IteratorResult<T>> {
    return this.generator.return(value);
  }

  async throw(e: Error): Promise<IteratorResult<T>> {
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
