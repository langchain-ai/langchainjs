import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { LLMChain } from "../chains/llm_chain.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { Callbacks } from "../callbacks/manager.js";
import { NAIVE_FIX_PROMPT } from "./prompts.js";

export class OutputFixingParser<T> extends BaseOutputParser<T> {
  parser: BaseOutputParser<T>;

  retryChain: LLMChain;

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
    super();
    this.parser = parser;
    this.retryChain = retryChain;
  }

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

  getFormatInstructions() {
    return this.parser.getFormatInstructions();
  }
}
