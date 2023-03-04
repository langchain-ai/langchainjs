import { LLMCallbackManager } from "../llms/index.js";

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

export class GenericChatMessage extends BaseChatMessage {
  role: string;

  constructor(text: string, role: string) {
    super(text);
    this.role = role;
  }

  _getType(): MessageType {
    return "generic";
  }
}

export interface ChatGeneration {
  message: BaseChatMessage;

  /**
   * Raw generation info from the provider.
   * May include things like reason for finishing (e.g. in {@link OpenAI})
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
}

export interface ChatResult {
  generations: ChatGeneration[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
}

export abstract class BaseChatModel {
  async generate(
    messages: BaseChatMessage[],
    stop?: string[]
  ): Promise<ChatResult> {
    return this._generate(messages, stop);
  }

  abstract _generate(
    messages: BaseChatMessage[],
    stop?: string[]
  ): Promise<ChatResult>;

  async call(
    messages: BaseChatMessage[],
    stop?: string[]
  ): Promise<BaseChatMessage> {
    const { generations } = await this.generate(messages, stop);
    return generations[0].message;
  }
}

export abstract class SimpleChatModel extends BaseChatModel {
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
          message,
        },
      ],
    };
  }
}
