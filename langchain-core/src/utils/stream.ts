export interface IterableReadableStreamInterface<T>
  extends ReadableStream<T>,
    AsyncGenerator<T> {}

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

  async next() {
    this.ensureReader();
    try {
      const result = await this.reader.read();
      if (result.done) this.reader.releaseLock(); // release lock when stream becomes closed
      return {
        done: result.done,
        value: result.value as T, // Cloudflare Workers typing fix
      };
    } catch (e) {
      this.reader.releaseLock(); // release lock when stream becomes errored
      throw e;
    }
  }

  async return() {
    this.ensureReader();
    // If wrapped in a Node stream, cancel is already called.
    if (this.locked) {
      const cancelPromise = this.reader.cancel(); // cancel first, but don't await yet
      this.reader.releaseLock(); // release lock first
      await cancelPromise; // now await it
    }
    return { done: true, value: undefined as T }; // This cast fixes TS typing, and convention is to ignore final chunk value anyway
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
      if (key in chunk) {
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
