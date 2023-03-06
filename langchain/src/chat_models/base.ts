import GPT3Tokenizer from "gpt3-tokenizer";
import {
  AIChatMessage,
  BaseChatMessage,
  BaseLanguageModel,
  BasePromptValue,
  ChatGeneration,
  ChatResult,
  LLMCallbackManager,
  LLMResult,
} from "../schema/index.js";

const getCallbackManager = (): LLMCallbackManager => ({
  handleStart: (..._args) => {
    // console.log(args);
  },
  handleEnd: (..._args) => {
    // console.log(args);
  },
  handleError: (..._args) => {
    // console.log(args);
  },
});

const getVerbosity = () => true;

export type SerializedChatModel = {
  _model: string;
  _type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export abstract class BaseChatModel extends BaseLanguageModel {
  callbackManager: LLMCallbackManager;

  verbose: boolean;

  protected constructor(
    callbackManager?: LLMCallbackManager,
    verbose?: boolean
  ) {
    super();
    this.callbackManager = callbackManager ?? getCallbackManager();
    this.verbose = verbose ?? getVerbosity();
  }

  async generate(
    messages: BaseChatMessage[][],
    stop?: string[]
  ): Promise<LLMResult> {
    const generations: ChatGeneration[][] = [];
    for (const message of messages) {
      const result = await this._generate(message, stop);
      generations.push(result.generations);
    }
    return {
      generations,
    };
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
    const { generations } = await this._generate(messages, stop);
    return generations[0].message;
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
  protected constructor(
    callbackManager?: LLMCallbackManager,
    verbose?: boolean
  ) {
    super(callbackManager, verbose);
  }

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
