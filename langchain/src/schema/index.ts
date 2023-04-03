import { Document } from "../document.js";

export type Example = Record<string, string>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues = Record<string, any>;

export type PartialValues = Record<
  string,
  string | (() => Promise<string>) | (() => string)
>;

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

  /** The name of the message sender in a multi-user chat. */
  name?: string;

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

export type AgentAction = {
  tool: string;
  toolInput: string;
  log: string;
};

export type AgentFinish = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  returnValues: Record<string, any>;
  log: string;
};
export type AgentStep = {
  action: AgentAction;
  observation: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;

/**
 * Base Index class. All indexes should extend this class.
 */
export abstract class BaseRetriever {
  abstract getRelevantDocuments(query: string): Promise<Document[]>;
}
/** Class to parse the output of an LLM call.
 */
export abstract class BaseOutputParser {
  /**
   * Parse the output of an LLM call.
   *
   * @param text - LLM output to parse.
   * @returns Parsed output.
   */
  abstract parse(text: string): Promise<unknown>;

  async parseWithPrompt(
    text: string,
    _prompt: BasePromptValue
  ): Promise<unknown> {
    return this.parse(text);
  }

  /**
   * Return a string describing the format of the output.
   * @returns Format instructions.
   * @example
   * ```json
   * {
   *  "foo": "bar"
   * }
   * ```
   */
  abstract getFormatInstructions(): string;

  /**
   * Return the string type key uniquely identifying this class of parser
   */
  _type(): string {
    throw new Error("_type not implemented");
  }
}

export class OutputParserException extends Error {
  constructor(message: string) {
    super(message);
  }
}

export abstract class BaseChatMessageHistory {
  public abstract get messages(): BaseChatMessage[];

  public abstract addUserMessage(message: string): void;

  public abstract addAIChatMessage(message: string): void;
}
