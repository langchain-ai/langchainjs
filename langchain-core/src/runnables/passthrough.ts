import { concat } from "../utils/stream.js";
import {
  Runnable,
  RunnableAssign,
  RunnableMap,
  RunnableMapLike,
} from "./base.js";
import { ensureConfig, type RunnableConfig } from "./config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunnablePassthroughFunc<RunInput = any> =
  | ((input: RunInput) => void)
  | ((input: RunInput, config?: RunnableConfig) => void)
  | ((input: RunInput) => Promise<void>)
  | ((input: RunInput, config?: RunnableConfig) => Promise<void>);

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class RunnablePassthrough<RunInput = any> extends Runnable<
  RunInput,
  RunInput
> {
  static lc_name() {
    return "RunnablePassthrough";
  }

  lc_namespace = ["langchain_core", "runnables"];

  lc_serializable = true;

  func?: RunnablePassthroughFunc<RunInput>;

  constructor(fields?: { func?: RunnablePassthroughFunc<RunInput> }) {
    super(fields);
    if (fields) {
      this.func = fields.func;
    }
  }

  async invoke(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): Promise<RunInput> {
    const config = ensureConfig(options);
    if (this.func) {
      await this.func(input, config);
    }

    return this._callWithConfig(
      (input: RunInput) => Promise.resolve(input),
      input,
      config
    );
  }

  async *transform(
    generator: AsyncGenerator<RunInput>,
    options: Partial<RunnableConfig>
  ): AsyncGenerator<RunInput> {
    const config = ensureConfig(options);
    let finalOutput: RunInput | undefined;
    let finalOutputSupported = true;

    for await (const chunk of this._transformStreamWithConfig(
      generator,
      (input: AsyncGenerator<RunInput>) => input,
      config
    )) {
      yield chunk;
      if (finalOutputSupported) {
        if (finalOutput === undefined) {
          finalOutput = chunk;
        } else {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            finalOutput = concat(finalOutput, chunk as any);
          } catch {
            finalOutput = undefined;
            finalOutputSupported = false;
          }
        }
      }
    }

    if (this.func && finalOutput !== undefined) {
      await this.func(finalOutput, config);
    }
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
   *   new ChatOpenAI({ model: "gpt-4o-mini" }).withConfig({ stop: ["\nSQLResult:"] }),
   *   new StringOutputParser(),
   * ]);
   * const result = await sqlQueryGeneratorChain.invoke({
   *   question: "How many employees are there?",
   * });
   * ```
   */
  static assign<
    RunInput extends Record<string, unknown> = Record<string, unknown>,
    RunOutput extends Record<string, unknown> = Record<string, unknown>
  >(
    mapping: RunnableMapLike<RunInput, RunOutput>
  ): RunnableAssign<RunInput, RunInput & RunOutput> {
    return new RunnableAssign(new RunnableMap({ steps: mapping }));
  }
}
