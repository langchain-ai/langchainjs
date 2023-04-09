import GPT3Tokenizer from "gpt3-tokenizer";
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
import { CallbackManager } from "../callbacks/index.js";

export type SerializedChatModel = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export type BaseChatModelParams = BaseLanguageModelParams;

export abstract class BaseChatModel extends BaseLanguageModel {
  protected constructor({ ...rest }: BaseChatModelParams) {
    super(rest);
  }

  async generate(
    messages: BaseChatMessage[][],
    stop?: string[],
    callbackManager?: CallbackManager
  ): Promise<LLMResult> {
    const generations: ChatGeneration[][] = [];
    let llmOutput = {};
    const messageStrings: string[] = messages.map((messageList) =>
      getBufferString(messageList)
    );
    const callbackManager_ =
      callbackManager?.copy(this.callbackManager.handlers) ??
      this.callbackManager;
    const runId = await callbackManager_.handleLLMStart(
      { name: this._llmType() },
      messageStrings,
      undefined,
      this.verbose
    );
    try {
      for (const message of messages) {
        const result = await this._generate(
          message,
          stop,
          callbackManager,
          runId
        );
        llmOutput = result.llmOutput ?? {};
        generations.push(result.generations);
      }
    } catch (err) {
      await callbackManager_.handleLLMError(err, runId, this.verbose);
      throw err;
    }

    const output: LLMResult = {
      generations,
      llmOutput: { ...llmOutput, runId },
    };
    await callbackManager_.handleLLMEnd(output, runId, this.verbose);
    return output;
  }

  /**
   * Get the identifying parameters of the LLM.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _identifyingParams(): Record<string, any> {
    return {};
  }

  _modelType(): string {
    return "base_chat_model" as const;
  }

  abstract _llmType(): string;

  /**
   * Return a json-like object representing this Chat model.
   */
  serialize(): SerializedChatModel {
    return {
      ...this._identifyingParams(),
      _type: this._llmType(),
      _model: this._modelType(),
    };
  }

  // TODO deserialize

  private _tokenizer?: GPT3Tokenizer.default;

  getNumTokens(text: string): number {
    // TODOs copied from py implementation
    // TODO: this method may not be exact.
    // TODO: this method may differ based on model (eg codex, gpt-3.5).
    if (this._tokenizer === undefined) {
      const Constructor = GPT3Tokenizer.default;
      this._tokenizer = new Constructor({ type: "gpt3" });
    }
    return this._tokenizer.encode(text).bpe.length;
  }

  async generatePrompt(
    promptValues: BasePromptValue[],
    stop?: string[],
    callbackManager?: CallbackManager
  ): Promise<LLMResult> {
    const promptMessages: BaseChatMessage[][] = promptValues.map(
      (promptValue) => promptValue.toChatMessages()
    );
    return this.generate(promptMessages, stop, callbackManager);
  }

  abstract _generate(
    messages: BaseChatMessage[],
    stop?: string[],
    callbackManager?: CallbackManager,
    runId?: string
  ): Promise<ChatResult>;

  async call(
    messages: BaseChatMessage[],
    stop?: string[],
    callbackManager?: CallbackManager
  ): Promise<BaseChatMessage> {
    const result = await this.generate([messages], stop, callbackManager);
    const generations = result.generations as ChatGeneration[][];
    return generations[0][0].message;
  }

  async callPrompt(
    promptValue: BasePromptValue,
    stop?: string[],
    callbackManager?: CallbackManager
  ): Promise<BaseChatMessage> {
    const promptMessages: BaseChatMessage[] = promptValue.toChatMessages();
    return this.call(promptMessages, stop, callbackManager);
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
