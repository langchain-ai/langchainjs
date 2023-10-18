import { IterableReadableStream } from "../../util/stream.js";
import { Runnable, RunnableMap } from "./base.js";
import type { RunnableConfig } from "./config.js";

export class RunnableAssign<
  RunInput = any,
  RunOutput = any,
  CallOptions extends RunnableConfig = RunnableConfig
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "schema", "runnable"];

  mapper: RunnableMap<RunInput>;

  async invoke(input: RunInput, options?: Partial<CallOptions>) {
    const mapperResult = await this.mapper.invoke(input, options);

    return {
      ...input,
      ...mapperResult,
    } as RunOutput;
  }

  async *transform(
    generator: AsyncGenerator<RunInput>,
    options: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    const mapperKeys = new Set(this.mapper.getStepsKeys());
    const mapOutput = this.mapper.transform(generator, options)

    for await (const chunk of mapOutput) {
      if (typeof chunk !== "object") {
        throw new Error(
          "The input to RunnablePassthrough.assign() must be an object."
        );
      }

      const filtered: Record<string, any> = {};
      for (const key in chunk) {
        if (!mapperKeys.has(key)) {
          filtered[key] = chunk[key];
        }
      }

      if (Object.keys(filtered).length > 0) {
        yield filtered as RunOutput;
      }
    }

    const firstMapChunk = await mapOutput.next();
    if (firstMapChunk.value) {
      yield firstMapChunk.value;
    }
    for await (const chunk of mapOutput) {
      yield chunk as RunOutput;
    }
  }

  async *_streamIterator(
    input: RunInput,
    options?: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    yield this.invoke(input, options);
  }

  async stream(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<IterableReadableStream<RunOutput>> {
    return IterableReadableStream.fromAsyncGenerator(
      this._streamIterator(input, options)
    );
  }
}

/**
 * A runnable that passes through the input.
 */
export class RunnablePassthrough<RunInput> extends Runnable<
  RunInput,
  RunInput
> {
  static lc_name() {
    return "RunnablePassthrough";
  }

  lc_namespace = ["langchain", "schema", "runnable"];

  lc_serializable = true;

  async invoke(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<RunInput> {
    return this._callWithConfig(
      (input: RunInput) => Promise.resolve(input),
      input,
      options
    );
  }

  static assign<RunInput = unknown>(mapping: Record<string, Runnable<Record<string, unknown>, unknown> | ((input: Record<string, unknown>) => unknown)>): RunnableAssign<RunInput, Record<string, unknown>> {
    const runnableMap = new RunnableMap<Record<string, unknown>>({ steps: {} });
    for (const key in mapping) {
      if (Object.prototype.hasOwnProperty.call(mapping, key)) {
        const value = mapping[key];
        if (Runnable.isRunnable(value)) {
          runnableMap.addStep(key, value);
        } else if (typeof value === "function") {
          runnableMap.addStep(key, new RunnablePassthrough(value));
        } else {
          throw new Error("Invalid mapping argument.");
        }
      }
    }
    return new RunnableAssign(runnableMap);
  }
}
