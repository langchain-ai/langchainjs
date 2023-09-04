/*
 * Support async iterator syntax for ReadableStreams in all environments.
 * Source: https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 */
export function readableStreamToAsyncIterable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream: any,
  preventCancel = false
) {
  if (stream[Symbol.asyncIterator]) {
    return stream[Symbol.asyncIterator]();
  }

  const reader = stream.getReader();

  return {
    async next() {
      try {
        const result = await reader.read();
        if (result.done) reader.releaseLock(); // release lock when stream becomes closed
        return result;
      } catch (e) {
        reader.releaseLock(); // release lock when stream becomes errored
        throw e;
      }
    },
    async return() {
      if (!preventCancel) {
        const cancelPromise = reader.cancel(); // cancel first, but don't await yet
        reader.releaseLock(); // release lock first
        await cancelPromise; // now await it
      } else {
        reader.releaseLock();
      }
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

export class IterableReadableStream<T> extends ReadableStream<T> {
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
      return result;
    } catch (e) {
      this.reader.releaseLock(); // release lock when stream becomes errored
      throw e;
    }
  }

  async return() {
    this.ensureReader();
    const cancelPromise = this.reader.cancel(); // cancel first, but don't await yet
    this.reader.releaseLock(); // release lock first
    await cancelPromise; // now await it
    return { done: true, value: undefined };
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function pump(): any {
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
    });
  }

  static fromAsyncGenerator<T>(generator: AsyncGenerator<T>) {
    return new IterableReadableStream<T>({
      async pull(controller) {
        const { value, done } = await generator.next();
        if (done) {
          controller.close();
        } else if (value) {
          controller.enqueue(value);
        }
      },
    });
  }
}
