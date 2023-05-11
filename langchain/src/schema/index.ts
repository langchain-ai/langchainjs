import { Document } from "../document.js";

export const RUN_KEY = "__run";

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
  /**
   * Dictionary of run metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [RUN_KEY]?: Record<string, any>;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunInputs = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RunOutputs = Record<string, any>;

/**
 * Base Index class. All indexes should extend this class.
 */
export abstract class BaseRetriever {
  abstract getRelevantDocuments(query: string): Promise<Document[]>;
}

export abstract class BaseChatMessageHistory {
  public abstract getMessages(): Promise<BaseChatMessage[]>;

  public abstract addUserMessage(message: string): Promise<void>;

  public abstract addAIChatMessage(message: string): Promise<void>;

  public abstract clear(): Promise<void>;
}

export abstract class BaseListChatMessageHistory {
  protected abstract addMessage(message: BaseChatMessage): Promise<void>;

  public addUserMessage(message: string): Promise<void> {
    return this.addMessage(new HumanChatMessage(message));
  }

  public addAIChatMessage(message: string): Promise<void> {
    return this.addMessage(new AIChatMessage(message));
  }
}

export abstract class BaseCache<T = Generation[]> {
  abstract lookup(prompt: string, llmKey: string): Promise<T | null>;

  abstract update(prompt: string, llmKey: string, value: T): Promise<void>;
}

export abstract class BaseFileStore {
  abstract readFile(path: string): Promise<string>;

  abstract writeFile(path: string, contents: string): Promise<void>;
}
