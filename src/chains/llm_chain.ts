import { BaseChain, ChainValues } from "./index";

import { BaseLLM, SerializedLLM } from "../llms";
import { BasePromptTemplate, SerializedBasePromptTemplate } from "../prompt";

import { resolveConfigFromFile } from "../util";

export interface LLMChainInput {
  prompt: BasePromptTemplate;
  llm: BaseLLM;
  outputKey: string;
}

export type SerializedLLMChain = {
  _type: "llm_chain";
  llm?: SerializedLLM;
  llm_path?: string;
  prompt?: SerializedBasePromptTemplate;
  prompt_path?: string;
};

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

  async _call(values: ChainValues): Promise<ChainValues> {
    let stop;
    if ("stop" in values && Array.isArray(values.stop)) {
      stop = values.stop;
    }
    const formattedString = this.prompt.format(values);
    const llmResult = await this.llm.call(formattedString, stop);
    const result = { [this.outputKey]: llmResult };
    return result;
  }

  async predict(values: ChainValues): Promise<string> {
    const output = await this.call(values);
    return output[this.outputKey];
  }

  _chainType() {
    return "llm_chain" as const;
  }

  static async deserialize(data: SerializedLLMChain) {
    const serializedLLM = resolveConfigFromFile<"llm", SerializedLLM>(
      "llm",
      data
    );
    const serializedPrompt = resolveConfigFromFile<
      "prompt",
      SerializedBasePromptTemplate
    >("prompt", data);

    return new LLMChain({
      llm: await BaseLLM.deserialize(serializedLLM),
      prompt: await BasePromptTemplate.deserialize(serializedPrompt),
    });
  }

  serialize(): SerializedLLMChain {
    return {
      _type: this._chainType(),
      llm: this.llm.serialize(),
      prompt: this.prompt.serialize(),
    };
  }
}
