import {
  AIChatMessage,
  BaseChatMessage,
  BasePromptValue,
  ChatGeneration,
  ChatResult,
  LLMResult,
} from "../schema/index.js";
import {
  BaseLanguageModel,
  BaseLanguageModelParams,
} from "../base_language/index.js";
import { getBufferString } from "../memory/base.js";

export type SerializedChatModel = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

// todo?
export type SerializedLLM = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export type BaseChatModelParams = BaseLanguageModelParams;

export abstract class BaseChatModel extends BaseLanguageModel {
  constructor(fields: BaseChatModelParams) {
    super(fields);
  }

  abstract _combineLLMOutput?(
    ...llmOutputs: LLMResult["llmOutput"][]
  ): LLMResult["llmOutput"];

  async generate(
    messages: BaseChatMessage[][],
    stop?: string[]
  ): Promise<LLMResult> {
    const generations: ChatGeneration[][] = [];
    const llmOutputs: LLMResult["llmOutput"][] = [];
    const messageStrings: string[] = messages.map((messageList) =>
      getBufferString(messageList)
    );
    await this.callbackManager.handleLLMStart(
      { name: this._llmType() },
      messageStrings,
      this.verbose
    );
    try {
      for (const message of messages) {
        const result = await this._generate(message, stop);
        if (result.llmOutput) {
          llmOutputs.push(result.llmOutput);
        }
        generations.push(result.generations);
      }
    } catch (err) {
      await this.callbackManager.handleLLMError(err, this.verbose);
      throw err;
    }

    const output: LLMResult = {
      generations,
      llmOutput: llmOutputs.length
        ? this._combineLLMOutput?.(...llmOutputs)
        : undefined,
    };
    await this.callbackManager.handleLLMEnd(output, this.verbose);
    return output;
  }

  _modelType(): string {
    return "base_chat_model" as const;
  }

  abstract _llmType(): string;

  async generatePrompt(
    promptValues: BasePromptValue[],
    stop?: string[]
  ): Promise<LLMResult> {
    const promptMessages: BaseChatMessage[][] = promptValues.map(
      (promptValue) => promptValue.toChatMessages()
    );
    return this.generate(promptMessages, stop);
  }

  abstract _generate(
    messages: BaseChatMessage[],
    stop?: string[]
  ): Promise<ChatResult>;

  async call(
    messages: BaseChatMessage[],
    stop?: string[]
  ): Promise<BaseChatMessage> {
    const result = await this.generate([messages], stop);
    const generations = result.generations as ChatGeneration[][];
    return generations[0][0].message;
  }

  async callPrompt(
    promptValue: BasePromptValue,
    stop?: string[]
  ): Promise<BaseChatMessage> {
    const promptMessages: BaseChatMessage[] = promptValue.toChatMessages();
    return this.call(promptMessages, stop);
  }
}

export abstract class SimpleChatModel extends BaseChatModel {
  abstract _call(messages: BaseChatMessage[], stop?: string[]): Promise<string>;

  async _generate(
    messages: BaseChatMessage[],
    stop?: string[]
  ): Promise<ChatResult> {
    const text = await this._call(messages, stop);
    const message = new AIChatMessage(text);
    return {
      generations: [
        {
          text: message.text,
          message,
        },
      ],
    };
  }
}
