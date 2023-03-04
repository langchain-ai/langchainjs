import { BaseChain, ChainInputs, ChainValues } from "./index.js";

import { BaseLLM, SerializedLLM } from "../llms/index.js";

import { BaseMemory, BufferMemory } from "../memory/index.js";
import {
  BasePromptTemplate,
  PromptTemplate,
  SerializedBasePromptTemplate,
  ChatPromptTemplate,
} from "../prompts/index.js";

import { resolveConfigFromFile } from "../util/index.js";
import { BaseChatModel } from "../chat_models/base.js";
import { SerializedChatPromptTemplate } from "../prompts/chat.js";

export interface BaseLLMChainInput extends ChainInputs {
  /** Output key to use */
  outputKey: string;
}

export interface LLMChainInput extends BaseLLMChainInput {
  /** Prompt object to use */
  prompt: BasePromptTemplate;

  /** LLM Wrapper to use */
  llm: BaseLLM;
}

export interface ChatModelChainInput extends BaseLLMChainInput {
  /** Prompt object to use */
  prompt: ChatPromptTemplate;

  /** ChatModel Wrapper to use */
  llm: BaseChatModel;
}

export type SerializedLLMChain = {
  _type: "llm_chain";
  llm?: SerializedLLM;
  llm_path?: string;
  prompt?: SerializedBasePromptTemplate;
  prompt_path?: string;
};

export type SerializedChatModelChain = {
  _type: "chat_model_chain";
  // TODO: add chat model serialization and path
  prompt?: SerializedChatPromptTemplate;
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
export abstract class BaseLLMChain
  extends BaseChain
  implements BaseLLMChainInput
{
  outputKey = "text";

  constructor(fields: { outputKey?: string; memory?: BaseMemory }) {
    super(fields.memory);
    this.outputKey = fields.outputKey ?? this.outputKey;
  }

  abstract _call(values: ChainValues): Promise<ChainValues>;

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
}

export class LLMChain extends BaseLLMChain implements LLMChainInput {
  llm: BaseLLM;

  prompt: BasePromptTemplate;

  get inputKeys() {
    return this.prompt.inputVariables;
  }

  constructor(fields: {
    prompt: BasePromptTemplate;
    llm: BaseLLM;
    outputKey?: string;
    memory?: BaseMemory;
  }) {
    super({ outputKey: fields.outputKey, memory: fields.memory });
    this.llm = fields.llm;
    this.prompt = fields.prompt;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    let stop;
    if ("stop" in values && Array.isArray(values.stop)) {
      stop = values.stop;
    }
    const formattedString = await this.prompt.format(values);
    const llmResult = await this.llm.call(formattedString, stop);
    return { [this.outputKey]: llmResult };
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
      llm: this.llm.serialize(),
      prompt: this.prompt.serialize(),
    };
  }

  _chainType() {
    return "llm_chain" as const;
  }
}

export class ChatModelChain
  extends BaseLLMChain
  implements ChatModelChainInput
{
  llm: BaseChatModel;

  prompt: ChatPromptTemplate;

  get inputKeys() {
    return this.prompt.inputVariables;
  }

  constructor(fields: {
    prompt: ChatPromptTemplate;
    llm: BaseChatModel;
    outputKey?: string;
    memory?: BaseMemory;
  }) {
    super({ outputKey: fields.outputKey, memory: fields.memory });
    this.llm = fields.llm;
    this.prompt = fields.prompt;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    let stop;
    if ("stop" in values && Array.isArray(values.stop)) {
      stop = values.stop;
    }
    const messages = await this.prompt.formatPromptValue(values);
    const llmResult = await this.llm.call(messages.toChatMessages(), stop);
    return { [this.outputKey]: llmResult };
  }

  // TODO: create a new serialization type for ChatModelChain
  // and implement these methods
  serialize(): SerializedChatModelChain {
    return {
      _type: this._chainType(),
      prompt: this.prompt.serialize(),
    };
  }

  _chainType() {
    return "chat_model_chain" as const;
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
