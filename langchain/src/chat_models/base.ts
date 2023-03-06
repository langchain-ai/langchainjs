import {
  LLMCallbackManager,
  Generation,
  LLMResult,
  BaseLanguageModel, BasePromptValue,

} from "../llms/index.js";

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

export type MessageType = "human" | "ai" | "generic" | "system";

export abstract class BaseChatMessage {
  /** The text of the message. */
  text: string;

  /** The type of the message. */
  abstract _getType(): MessageType;

  constructor(text: string) {
    this.text = text;
  }
}

export class HumanChatMessage extends BaseChatMessage {
  _getType(): MessageType {
    return "human";
  }
}

export class AIChatMessage extends BaseChatMessage {
  _getType(): MessageType {
    return "ai";
  }
}

export class SystemChatMessage extends BaseChatMessage {
  _getType(): MessageType {
    return "system";
  }
}

export class ChatMessage extends BaseChatMessage {
  role: string;

  constructor(text: string, role: string) {
    super(text);
    this.role = role;
  }

  _getType(): MessageType {
    return "generic";
  }
}

export interface ChatGeneration extends Generation {
  message: BaseChatMessage;
}

export interface ChatResult {
  generations: ChatGeneration[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
}

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
