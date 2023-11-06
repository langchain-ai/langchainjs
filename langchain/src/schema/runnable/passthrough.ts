import { Runnable, RunnableLike, RunnableMap } from "./base.js";
import type { RunnableConfig } from "./config.js";

/**
 * A runnable that assigns key-value pairs to inputs of type `Record<string, unknown>`.
 */
export class RunnableAssign<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any> = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = any,
  CallOptions extends RunnableConfig = RunnableConfig
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "schema", "runnable"];

  mapper: RunnableMap<RunInput>;

  constructor(mapper: RunnableMap<RunInput>) {
    super();
    this.mapper = mapper;
  }

  async invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput> {
    const mapperResult = await this.mapper.invoke(input, options);

    return {
      ...input,
      ...mapperResult,
    } as RunOutput;
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

  static assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapping: Record<string, RunnableLike<Record<string, unknown>, any>>
  ): RunnableAssign<Record<string, unknown>, Record<string, unknown>> {
    return new RunnableAssign(
      new RunnableMap<Record<string, unknown>>({ steps: mapping })
    );
  }
}
