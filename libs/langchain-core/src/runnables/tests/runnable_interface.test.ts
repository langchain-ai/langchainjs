/* eslint-disable @typescript-eslint/no-explicit-any */

import { test, expect } from "vitest";
import { StringOutputParser } from "../../output_parsers/string.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { RunnableSequence } from "../base.js";

type RunnableBatchOptionsV0 = {
  maxConcurrency?: number;
  returnExceptions?: boolean;
};

interface RunnableInterfaceV0<RunInput, RunOutput, CallOptions = any> {
  invoke(input: RunInput, options?: Partial<CallOptions>): Promise<RunOutput>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptionsV0 & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptionsV0 & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptionsV0
  ): Promise<(RunOutput | Error)[]>;

  batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptionsV0
  ): Promise<(RunOutput | Error)[]>;

  stream(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<IterableReadableStreamV0<RunOutput>>;

  transform(
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput>;

  getName(suffix?: string): string;

  get lc_id(): string[];
}

class IterableReadableStreamV0<T> extends ReadableStream<T> {
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

  async throw(e: any): Promise<IteratorResult<T>> {
    throw e;
  }

  [Symbol.asyncIterator]() {
    return this as any;
  }

  static fromReadableStream<T>(stream: ReadableStream<T>) {
    // From https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams#reading_the_stream
    const reader = stream.getReader();
    return new IterableReadableStreamV0<T>({
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
    return new IterableReadableStreamV0<T>({
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

/**
 * Base class for all types of messages in a conversation. It includes
 * properties like `content`, `name`, and `additional_kwargs`. It also
 * includes methods like `toDict()` and `_getType()`.
 */
class AIMessageV0 {
  lc_namespace = ["langchain_core", "messages"];

  lc_serializable = true;

  /** The content of the message. */
  content: string;

  /** The name of the message sender in a multi-user chat. */
  name?: string;

  /** The type of the message. */
  _getType() {
    return "ai";
  }

  constructor(content: string) {
    this.content = content;
  }
}

class StringPromptValueV0 {
  lc_namespace = ["langchain_core", "prompt_values"];

  lc_serializable = true;

  value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

class RunnableV0
  implements RunnableInterfaceV0<StringPromptValueV0, AIMessageV0>
{
  lc_serializable = true;

  protected lc_runnable = true;

  async invoke(
    input: StringPromptValueV0,
    _options?: Partial<any> | undefined
  ): Promise<AIMessageV0> {
    return new AIMessageV0(input.toString());
  }

  async batch(
    inputs: StringPromptValueV0[],
    options?: Partial<any> | Partial<any>[] | undefined,
    batchOptions?:
      | (RunnableBatchOptionsV0 & { returnExceptions?: false | undefined })
      | undefined
  ): Promise<AIMessageV0[]>;

  async batch(
    inputs: StringPromptValueV0[],
    options?: Partial<any> | Partial<any>[] | undefined,
    batchOptions?:
      | (RunnableBatchOptionsV0 & { returnExceptions: true })
      | undefined
  ): Promise<AIMessageV0[]>;

  async batch(
    inputs: StringPromptValueV0[],
    options?: Partial<any> | Partial<any>[] | undefined,
    batchOptions?: RunnableBatchOptionsV0 | undefined
  ): Promise<AIMessageV0[]>;

  async batch(
    inputs: StringPromptValueV0[],
    options?: Partial<any> | Partial<any>[] | undefined,
    batchOptions?: RunnableBatchOptionsV0 | undefined
  ): Promise<AIMessageV0[]>;

  async batch(
    _inputs: unknown,
    _options?: unknown,
    _batchOptions?: unknown
  ): Promise<AIMessageV0[]> {
    return [];
  }

  async stream(
    _input: StringPromptValueV0,
    _options?: Partial<any> | undefined
  ): Promise<IterableReadableStreamV0<any>> {
    throw new Error("Not implemented");
  }

  // eslint-disable-next-line require-yield
  async *transform(
    _generator: AsyncGenerator<StringPromptValueV0>,
    _options: Partial<any>
  ): AsyncGenerator<AIMessageV0> {
    throw new Error("Not implemented");
  }

  getName(): string {
    return "TEST";
  }

  get lc_id(): string[] {
    return ["TEST"];
  }
}

test("Pipe with a class that implements a runnable interface", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new RunnableV0();
  const outputParser = new StringOutputParser();
  const runnable = promptTemplate.pipe(llm).pipe(outputParser);
  const result = await runnable.invoke({ input: "Hello world!!" });
  console.log(result);
  expect(result).toBe("Hello world!!");
});

test("Runnable sequence with a class that implements a runnable interface", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new RunnableV0();
  const outputParser = new StringOutputParser();
  const runnable = RunnableSequence.from([promptTemplate, llm, outputParser]);
  const result = await runnable.invoke({ input: "Hello sequence!!" });
  console.log(result);
  expect(result).toBe("Hello sequence!!");
});
