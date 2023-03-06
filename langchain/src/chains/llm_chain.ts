import { BaseChain, ChainInputs, ChainValues } from "./index.js";

import { BaseLLM, SerializedLLM } from "../llms/index.js";
import { BaseLanguageModel } from "../schema/index.js";

import { BaseMemory, BufferMemory } from "../memory/index.js";
import {
  BasePromptTemplate,
  PromptTemplate,
  SerializedBasePromptTemplate,
} from "../prompts/index.js";

import { resolveConfigFromFile } from "../util/index.js";

export interface LLMChainInput extends ChainInputs {
  /** Prompt object to use */
  prompt: BasePromptTemplate;
  /** LLM Wrapper to use */
  llm: BaseLanguageModel;

  /** @ignore */
  outputKey: string;
}

export type SerializedLLMChain = {
  _type: "llm_chain";
  llm?: SerializedLLM;
  llm_path?: string;
  prompt?: SerializedBasePromptTemplate;
  prompt_path?: string;
};

/**
 * Chain to run queries against LLMs.
 * @augments BaseChain
 * @augments LLMChainInput
 *
 * @example
 * ```ts
 * import { LLMChain, OpenAI, PromptTemplate } from "langchain";
 * const prompt = PromptTemplate.fromTemplate("Tell me a {adjective} joke");
 * const llm = LLMChain({ llm: new OpenAI(), prompt });
 * ```
 */
export class LLMChain extends BaseChain implements LLMChainInput {
  prompt: BasePromptTemplate;

  llm: BaseLanguageModel;

  outputKey = "text";

  get inputKeys() {
    return this.prompt.inputVariables;
  }

  constructor(fields: {
    prompt: BasePromptTemplate;
    llm: BaseLanguageModel;
    outputKey?: string;
    memory?: BaseMemory;
  }) {
    super(fields.memory);
    this.prompt = fields.prompt;
    this.llm = fields.llm;
    this.outputKey = fields.outputKey ?? this.outputKey;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    let stop;
    if ("stop" in values && Array.isArray(values.stop)) {
      stop = values.stop;
    }
    const promptValue = await this.prompt.formatPromptValue(values);
    const { generations } = await this.llm.generatePrompt([promptValue], stop);
    return { [this.outputKey]: generations[0][0].text };
  }

  /**
   * Format prompt with values and pass to LLM
   *
   * @param values - keys to pass to prompt template
   * @returns Completion from LLM.
   *
   * @example
   * ```ts
   * llm.predict({ adjective: "funny" })
   * ```
   */
  async predict(values: ChainValues): Promise<string> {
    const output = await this.call(values);
    return output[this.outputKey];
  }

  _chainType() {
    return "llm_chain" as const;
  }

  static async deserialize(data: SerializedLLMChain) {
    const serializedLLM = await resolveConfigFromFile<"llm", SerializedLLM>(
      "llm",
      data
    );
    const serializedPrompt = await resolveConfigFromFile<
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
      // llm: this.llm.serialize(), TODO fix this now that llm is BaseLanguageModel
      prompt: this.prompt.serialize(),
    };
  }
}

// eslint-disable-next-line max-len
const defaultTemplate = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{history}
Human: {input}
AI:`;

const defaultPrompt = new PromptTemplate({
  template: defaultTemplate,
  inputVariables: ["history", "input"],
});

export class ConversationChain extends LLMChain {
  constructor(fields: {
    llm: BaseLLM;
    prompt?: BasePromptTemplate;
    outputKey?: string;
    memory?: BaseMemory;
  }) {
    super({
      prompt: fields.prompt ?? defaultPrompt,
      llm: fields.llm,
      outputKey: fields.outputKey ?? "response",
    });
    this.memory = fields.memory ?? new BufferMemory();
  }
}
