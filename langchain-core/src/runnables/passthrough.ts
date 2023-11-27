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
  lc_namespace = ["langchain_core", "runnables"];

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
  static assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapping: Record<string, RunnableLike<Record<string, unknown>, any>>
  ): RunnableAssign<Record<string, unknown>, Record<string, unknown>> {
    return new RunnableAssign(
      new RunnableMap<Record<string, unknown>>({ steps: mapping })
    );
  }
}
