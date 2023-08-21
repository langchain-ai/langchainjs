import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { LLMChain } from "../chains/llm_chain.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { Callbacks } from "../callbacks/manager.js";
import { NAIVE_FIX_PROMPT } from "./prompts.js";

/**
 * Class that extends the BaseOutputParser to handle situations where the
 * initial parsing attempt fails. It contains a retryChain for retrying
 * the parsing process in case of a failure.
 */
export class OutputFixingParser<T> extends BaseOutputParser<T> {
  static lc_name() {
    return "OutputFixingParser";
  }

  lc_namespace = ["langchain", "output_parsers", "fix"];

  lc_serializable = true;

  parser: BaseOutputParser<T>;

  retryChain: LLMChain;

  /**
   * Static method to create a new instance of OutputFixingParser using a
   * given language model, parser, and optional fields.
   * @param llm The language model to be used.
   * @param parser The parser to be used.
   * @param fields Optional fields which may contain a prompt.
   * @returns A new instance of OutputFixingParser.
   */
  static fromLLM<T>(
    llm: BaseLanguageModel,
    parser: BaseOutputParser<T>,
    fields?: {
      prompt?: BasePromptTemplate;
    }
  ) {
    const prompt = fields?.prompt ?? NAIVE_FIX_PROMPT;
    const chain = new LLMChain({ llm, prompt });
    return new OutputFixingParser<T>({ parser, retryChain: chain });
  }

  constructor({
    parser,
    retryChain,
  }: {
    parser: BaseOutputParser<T>;
    retryChain: LLMChain;
  }) {
    super(...arguments);
    this.parser = parser;
    this.retryChain = retryChain;
  }

  /**
   * Method to parse the completion using the parser. If the initial parsing
   * fails, it uses the retryChain to attempt to fix the output and retry
   * the parsing process.
   * @param completion The completion to be parsed.
   * @param callbacks Optional callbacks to be used during parsing.
   * @returns The parsed output.
   */
  async parse(completion: string, callbacks?: Callbacks) {
    try {
      return await this.parser.parse(completion, callbacks);
    } catch (e) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (e instanceof OutputParserException) {
        const result = await this.retryChain.call(
          {
            instructions: this.parser.getFormatInstructions(),
            completion,
            error: e,
          },
          callbacks
        );
        const newCompletion: string = result[this.retryChain.outputKey];
        return this.parser.parse(newCompletion);
      }
      throw e;
    }
  }

  /**
   * Method to get the format instructions for the parser.
   * @returns The format instructions for the parser.
   */
  getFormatInstructions() {
    return this.parser.getFormatInstructions();
  }
}
