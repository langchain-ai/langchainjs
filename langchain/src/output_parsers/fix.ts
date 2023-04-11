import { BaseOutputParser, OutputParserException } from "../schema/index.js";
import { BasePromptTemplate } from "../prompts/base.js";
import { LLMChain } from "../chains/llm_chain.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { NAIVE_FIX_PROMPT } from "./prompts.js";

export class OutputFixingParser extends BaseOutputParser {
  parser: BaseOutputParser;

  retryChain: LLMChain;

  static fromLLM(
    llm: BaseLanguageModel,
    parser: BaseOutputParser,
    fields?: {
      prompt?: BasePromptTemplate;
    }
  ) {
    const prompt = fields?.prompt ?? NAIVE_FIX_PROMPT;
    const chain = new LLMChain({ llm, prompt });
    return new OutputFixingParser({ parser, retryChain: chain });
  }

  constructor({
    parser,
    retryChain,
  }: {
    parser: BaseOutputParser;
    retryChain: LLMChain;
  }) {
    super();
    this.parser = parser;
    this.retryChain = retryChain;
  }

  async parse(completion: string) {
    try {
      return await this.parser.parse(completion);
    } catch (e) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (e instanceof OutputParserException) {
        const result = await this.retryChain.call({
          instructions: this.parser.getFormatInstructions(),
          completion,
          error: e,
        });
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
