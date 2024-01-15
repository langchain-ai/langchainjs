import {
  Runnable,
  RunnableAssign,
  RunnableMap,
  RunnableMapLike,
} from "./base.js";
import type { RunnableConfig } from "./config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunnablePassthroughFunc<RunInput = any, RunOutput = any> =
  | ((input: RunInput) => RunOutput)
  | ((input: RunInput, config?: RunnableConfig) => RunOutput);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunnablePassthroughAsyncGeneratorFunc<RunInput = any, RunOutput = any> =
  | ((input: AsyncGenerator<RunInput>) => AsyncGenerator<RunOutput>)
  | ((
      input: AsyncGenerator<RunInput>,
      config?: RunnableConfig
    ) => AsyncGenerator<RunOutput>);

/**
 * Call an AsyncGenerator function that may optionally accept a config.
 */
function callAsyncGeneratorFuncWithVariableArgs<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput = any
>({
  func,
  input,
  config,
}: {
  func: RunnablePassthroughAsyncGeneratorFunc<RunInput, RunOutput>;
  input: AsyncGenerator<RunInput>;
  config?: RunnableConfig;
}): AsyncGenerator<RunOutput> {
  return func(input, config);
}

/**
 * Call function that may optionally accept a config.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callFuncWithVariableArgs<RunInput = any, RunOutput = any>({
  func,
  input,
  config,
}: {
  func: RunnablePassthroughFunc<RunInput, RunOutput>;
  input: RunInput;
  config?: RunnableConfig;
}) {
  return func(input, config);
}

/**
 * A runnable to passthrough inputs unchanged or with additional keys.
 *
 * This runnable behaves almost like the identity function, except that it
 * can be configured to add additional keys to the output, if the input is
 * an object.
 *
 * The example below demonstrates how to use `RunnablePassthrough to
 * passthrough the input from the `.invoke()`
 *
 * @example
 * ```typescript
 * const chain = RunnableSequence.from([
 *   {
 *     question: new RunnablePassthrough(),
 *     context: async () => loadContextFromStore(),
 *   },
 *   prompt,
 *   llm,
 *   outputParser,
 * ]);
 * const response = await chain.invoke(
 *   "I can pass a single string instead of an object since I'm using `RunnablePassthrough`."
 * );
 * ```
 */
export class RunnablePassthrough<RunInput> extends Runnable<
  RunInput,
  RunInput
> {
  static lc_name() {
    return "RunnablePassthrough";
  }

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  func?:
    | RunnablePassthroughFunc<RunInput>
    | RunnablePassthroughAsyncGeneratorFunc<RunInput>;

  constructor(fields?: {
    func?:
      | RunnablePassthroughFunc<RunInput>
      | RunnablePassthroughAsyncGeneratorFunc<RunInput>;
  }) {
    super(fields);
    if (fields) {
      this.func = fields.func;
    }
  }

  async invoke(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<RunInput> {
    if (this.func) {
      return callFuncWithVariableArgs<RunInput>({
        func: this.func as RunnablePassthroughFunc<RunInput>,
        input,
        config: options,
      });
    }

    return this._callWithConfig(
      (input: RunInput) => Promise.resolve(input),
      input,
      options
    );
  }

  transform(
    generator: AsyncGenerator<RunInput>,
    options: Partial<RunnableConfig>
  ): AsyncGenerator<RunInput> {
    if (this.func) {
      return callAsyncGeneratorFuncWithVariableArgs<RunInput>({
        func: this.func as RunnablePassthroughAsyncGeneratorFunc<RunInput>,
        input: generator,
        config: options,
      });
    }

    return this._transformStreamWithConfig(
      generator,
      (input: AsyncGenerator<RunInput>) => input,
      options
    );
  }

  /**
   * A runnable that assigns key-value pairs to the input.
   *
   * The example below shows how you could use it with an inline function.
   *
   * @example
   * ```typescript
   * const prompt =
   *   PromptTemplate.fromTemplate(`Write a SQL query to answer the question using the following schema: {schema}
   * Question: {question}
   * SQL Query:`);
   *
   * // The `RunnablePassthrough.assign()` is used here to passthrough the input from the `.invoke()`
   * // call (in this example it's the question), along with any inputs passed to the `.assign()` method.
   * // In this case, we're passing the schema.
   * const sqlQueryGeneratorChain = RunnableSequence.from([
   *   RunnablePassthrough.assign({
   *     schema: async () => db.getTableInfo(),
   *   }),
   *   prompt,
   *   new ChatOpenAI({}).bind({ stop: ["\nSQLResult:"] }),
   *   new StringOutputParser(),
   * ]);
   * const result = await sqlQueryGeneratorChain.invoke({
   *   question: "How many employees are there?",
   * });
   * ```
   */
  static assign<
    RunInput extends Record<string, unknown>,
    RunOutput extends Record<string, unknown>
  >(
    mapping: RunnableMapLike<RunInput, RunOutput>
  ): RunnableAssign<RunInput, RunInput & RunOutput> {
    return new RunnableAssign(new RunnableMap({ steps: mapping }));
  }
}
