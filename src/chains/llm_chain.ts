import { BaseChain, ChainValues } from "./index";

import { BaseLLM } from "../llms";

import { BasePromptTemplate } from "../prompt";

export interface LLMChainInput {
  prompt: BasePromptTemplate;
  llm: BaseLLM;
  outputKey: string;
}

export class LLMChain extends BaseChain implements LLMChainInput {
  prompt: BasePromptTemplate;

  llm: BaseLLM;

  outputKey = "text";

  constructor(fields: {
    prompt: BasePromptTemplate;
    llm: BaseLLM;
    outputKey?: string;
  }) {
    super();
    this.prompt = fields.prompt;
    this.llm = fields.llm;
    this.outputKey = fields.outputKey ?? this.outputKey;
  }

  async call(values: ChainValues): Promise<ChainValues> {
    const formattedString = this.prompt.format(values);
    const llmResult = await this.llm.call(formattedString);
    const result = { [this.outputKey]: llmResult };
    return result;
  }
}
