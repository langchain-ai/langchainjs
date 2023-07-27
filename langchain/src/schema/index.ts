import { ChatCompletionRequestMessageFunctionCall } from "openai";
import { Document } from "../document.js";
import { Serializable, SerializedConstructor } from "../load/serializable.js";

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

export interface StoredMessageData {
  content: string;
  role: string | undefined;
  name: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additional_kwargs?: Record<string, any>;
}

export interface StoredMessage {
  type: string;
  data: StoredMessageData;
}

export type MessageType = "human" | "ai" | "generic" | "system" | "function";

export interface BaseMessageFields {
  content: string;
  name?: string;
  additional_kwargs?: {
    function_call?: ChatCompletionRequestMessageFunctionCall;
    [key: string]: unknown;
  };
}

export interface ChatMessageFieldsWithRole extends BaseMessageFields {
  role: string;
}

export abstract class BaseMessage
  extends Serializable
  implements BaseMessageFields
{
  lc_namespace = ["langchain", "schema"];

  lc_serializable = true;

  /**
   * @deprecated
   * Use {@link BaseMessage.content} instead.
   */
  get text(): string {
    return this.content;
  }

  /** The text of the message. */
  content: string;

  /** The name of the message sender in a multi-user chat. */
  name?: string;

  /** Additional keyword arguments */
  additional_kwargs: NonNullable<BaseMessageFields["additional_kwargs"]>;

  /** The type of the message. */
  abstract _getType(): MessageType;

  constructor(
    fields: string | BaseMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign
      fields = { content: fields, additional_kwargs: kwargs };
    }
    // Make sure the default value for additional_kwargs is passed into super() for serialization
    if (!fields.additional_kwargs) {
      // eslint-disable-next-line no-param-reassign
      fields.additional_kwargs = {};
    }
    super(fields);
    this.name = fields.name;
    this.content = fields.content;
    this.additional_kwargs = fields.additional_kwargs;
  }

  toDict(): StoredMessage {
    return {
      type: this._getType(),
      data: (this.toJSON() as SerializedConstructor)
        .kwargs as StoredMessageData,
    };
  }
}

export class HumanMessage extends BaseMessage {
  _getType(): MessageType {
    return "human";
  }
}

export class AIMessage extends BaseMessage {
  _getType(): MessageType {
    return "ai";
  }
}

export class SystemMessage extends BaseMessage {
  _getType(): MessageType {
    return "system";
  }
}

/**
 * @deprecated
 * Use {@link BaseMessage} instead.
 */
export const BaseChatMessage = BaseMessage;

/**
 * @deprecated
 * Use {@link HumanMessage} instead.
 */
export const HumanChatMessage = HumanMessage;

/**
 * @deprecated
 * Use {@link AIMessage} instead.
 */
export const AIChatMessage = AIMessage;

/**
 * @deprecated
 * Use {@link SystemMessage} instead.
 */
export const SystemChatMessage = SystemMessage;

export class FunctionMessage extends BaseMessage {
  constructor(
    fields: string | BaseMessageFields,
    /** @deprecated */
    name: string
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign
      fields = { content: fields, name };
    }
    super(fields);
  }

  _getType(): MessageType {
    return "function";
  }
}

export class ChatMessage
  extends BaseMessage
  implements ChatMessageFieldsWithRole
{
  role: string;

  constructor(content: string, role: string);

  constructor(fields: ChatMessageFieldsWithRole);

  constructor(fields: string | ChatMessageFieldsWithRole, role?: string) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  _getType(): MessageType {
    return "generic";
  }
}

export interface ChatGeneration extends Generation {
  message: BaseMessage;
}

export interface ChatResult {
  generations: ChatGeneration[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
}

/**
 * Base PromptValue class. All prompt values should extend this class.
 */
export abstract class BasePromptValue extends Serializable {
  abstract toString(): string;

  abstract toChatMessages(): BaseMessage[];
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

export abstract class BaseChatMessageHistory extends Serializable {
  public abstract getMessages(): Promise<BaseMessage[]>;

  public abstract addUserMessage(message: string): Promise<void>;

  public abstract addAIChatMessage(message: string): Promise<void>;

  public abstract clear(): Promise<void>;
}

export abstract class BaseListChatMessageHistory extends Serializable {
  protected abstract addMessage(message: BaseMessage): Promise<void>;

  public addUserMessage(message: string): Promise<void> {
    return this.addMessage(new HumanMessage(message));
  }

  public addAIChatMessage(message: string): Promise<void> {
    return this.addMessage(new AIMessage(message));
  }
}

export abstract class BaseCache<T = Generation[]> {
  abstract lookup(prompt: string, llmKey: string): Promise<T | null>;

  abstract update(prompt: string, llmKey: string, value: T): Promise<void>;
}

export abstract class BaseFileStore extends Serializable {
  abstract readFile(path: string): Promise<string>;

  abstract writeFile(path: string, contents: string): Promise<void>;
}

export abstract class BaseEntityStore extends Serializable {
  abstract get(key: string, defaultValue?: string): Promise<string | undefined>;

  abstract set(key: string, value?: string): Promise<void>;

  abstract delete(key: string): Promise<void>;

  abstract exists(key: string): Promise<boolean>;

  abstract clear(): Promise<void>;
}

export abstract class Docstore {
  abstract search(search: string): Promise<Document>;

  abstract add(texts: Record<string, Document>): Promise<void>;
}
