export type LLMCallbackManager = {
  handleStart?: (
    llm: { name: string },
    prompts: string[],
    verbose?: boolean
  ) => void;
  handleNewToken?: (token: string, verbose?: boolean) => void;
  handleError?: (err: string, verbose?: boolean) => void;
  handleEnd?: (output: LLMResult, verbose?: boolean) => void;
};

/**
 * Output of a single generation.
 */
export interface Generation {
  /**
   * Generated text output
   */
  text: string;
  /**
   * Raw generation info response from the provider.
   * May include things like reason for finishing (e.g. in {@link OpenAI})
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
}

/**
 * Contains all relevant information returned by an LLM.
 */
export type LLMResult = {
  /**
   * List of the things generated. Each input could have multiple {@link Generation | generations}, hence this is a list of lists.
   */
  generations: Generation[][];
  /**
   * Dictionary of arbitrary LLM-provider specific output.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
};
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

/**
 * Base PromptValue class. All prompt values should extend this class.
 */
export abstract class BasePromptValue {
  abstract toString(): string;

  abstract toChatMessages(): BaseChatMessage[];
}

/**
 * Base class for language models.
 */
export abstract class BaseLanguageModel {
  abstract generatePrompt(
    promptValues: BasePromptValue[],
    stop?: string[]
  ): Promise<LLMResult>;

  abstract _modelType(): string;

  abstract getNumTokens(text: string): number;
}
