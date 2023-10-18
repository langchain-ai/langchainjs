import { IterableReadableStream } from "../../util/stream.js";
import { Runnable, RunnableMap } from "./base.js";
import type { RunnableConfig } from "./config.js";

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
}

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
    /** @TODO - how to access since it's protected */
    // collect mapper keys
    const mapperKeys = new Set(Object.keys(this.mapper.steps));

    /** @TODO - figure out py port */
    // create two streams, one for the map and one for the passthrough
    const [forPassthrough, forMap] = safetee(generator, 2);

    // create map output stream
    const mapOutput = this.mapper.transform(forMap, options);

    // consume passthrough stream
    for await (const chunk of forPassthrough) {
      if (typeof chunk !== "object") {
        throw new Error(
          "The input to RunnablePassthrough.assign() must be a dict."
        );
      }
      // remove mapper keys from passthrough chunk, to be overwritten by map
      const filtered: Record<string, any> = {};
      for (const key in chunk) {
        if (!mapperKeys.has(key)) {
          filtered[key] = chunk[key];
        }
      }
      if (Object.keys(filtered).length > 0) {
        yield filtered;
      }
    }

    // yield map output
    const firstMapChunk = await mapOutput.next();
    if (firstMapChunk.value) {
      yield firstMapChunk.value;
    }
    for await (const chunk of mapOutput) {
      yield chunk;
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
