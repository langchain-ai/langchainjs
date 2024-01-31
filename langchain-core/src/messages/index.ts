import { Serializable, SerializedConstructor } from "../load/serializable.js";
import type { StringWithAutocomplete } from "../utils/types.js";

export interface StoredMessageData {
  content: string;
  role: string | undefined;
  name: string | undefined;
  tool_call_id: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additional_kwargs?: Record<string, any>;
}

export interface StoredMessage {
  type: string;
  data: StoredMessageData;
}

export interface StoredGeneration {
  text: string;
  message?: StoredMessage;
}

interface StoredMessageV1 {
  type: string;
  role: string | undefined;
  text: string;
}

export type MessageType =
  | "human"
  | "ai"
  | "generic"
  | "system"
  | "function"
  | "tool";

type ImageDetail = "auto" | "low" | "high";

export type MessageContentText = {
  type: "text";
  text: string;
};

export type MessageContentImageUrl = {
  type: "image_url";
  image_url:
    | string
    | { url: string; detail?: ImageDetail };
};

export type MessageContentComplex = MessageContentText | MessageContentImageUrl;

export type MessageContent = string | MessageContentComplex[];

export interface FunctionCall {
  /**
   * The arguments to call the function with, as generated by the model in JSON
   * format. Note that the model does not always generate valid JSON, and may
   * hallucinate parameters not defined by your function schema. Validate the
   * arguments in your code before calling your function.
   */
  arguments: string;

  /**
   * The name of the function to call.
   */
  name: string;
}

export interface ToolCall {
  /**
   * The ID of the tool call.
   */
  id: string;

  /**
   * The function that the model called.
   */
  function: FunctionCall;

  /**
   * The type of the tool. Currently, only `function` is supported.
   */
  type: "function";
}

export interface BaseMessageFields {
  content: MessageContent;
  name?: string;
  additional_kwargs?: {
    function_call?: FunctionCall;
    tool_calls?: ToolCall[];
    [key: string]: unknown;
  };
}

export interface ChatMessageFieldsWithRole extends BaseMessageFields {
  role: string;
}

export interface FunctionMessageFieldsWithName extends BaseMessageFields {
  name: string;
}

export interface ToolMessageFieldsWithToolCallId extends BaseMessageFields {
  tool_call_id: string;
}

function mergeContent(
  firstContent: MessageContent,
  secondContent: MessageContent
): MessageContent {
  // If first content is a string
  if (typeof firstContent === "string") {
    if (typeof secondContent === "string") {
      return firstContent + secondContent;
    } else {
      return [{ type: "text", text: firstContent }, ...secondContent];
    }
    // If both are arrays
  } else if (Array.isArray(secondContent)) {
    return [...firstContent, ...secondContent];
    // If the first content is a list and second is a string
  } else {
    // Otherwise, add the second content as a new element of the list
    return [...firstContent, { type: "text", text: secondContent }];
  }
}

/**
 * Base class for all types of messages in a conversation. It includes
 * properties like `content`, `name`, and `additional_kwargs`. It also
 * includes methods like `toDict()` and `_getType()`.
 */
export abstract class BaseMessage
  extends Serializable
  implements BaseMessageFields
{
  lc_namespace = ["langchain_core", "messages"];

  lc_serializable = true;

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return { additional_kwargs: "additional_kwargs" };
  }

  /**
   * @deprecated
   * Use {@link BaseMessage.content} instead.
   */
  get text(): string {
    return typeof this.content === "string" ? this.content : "";
  }

  /** The content of the message. */
  content: MessageContent;

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

  toChunk(): BaseMessageChunk {
    const type = this._getType();
    if (type === "human") {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return new HumanMessageChunk({ ...this });
    } else if (type === "ai") {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return new AIMessageChunk({ ...this });
    } else if (type === "system") {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return new SystemMessageChunk({ ...this });
    } else if (type === "function") {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return new FunctionMessageChunk({ ...this });
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
    } else if (ChatMessage.isInstance(this)) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return new ChatMessageChunk({ ...this });
    } else {
      throw new Error("Unknown message type.");
    }
  }
}

// TODO: Deprecate when SDK typing is updated
export type OpenAIToolCall = ToolCall & {
  index: number;
};

function isOpenAIToolCallArray(value?: unknown): value is OpenAIToolCall[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof (v as OpenAIToolCall).index === "number")
  );
}

/**
 * Represents a chunk of a message, which can be concatenated with other
 * message chunks. It includes a method `_merge_kwargs_dict()` for merging
 * additional keyword arguments from another `BaseMessageChunk` into this
 * one. It also overrides the `__add__()` method to support concatenation
 * of `BaseMessageChunk` instances.
 */
export abstract class BaseMessageChunk extends BaseMessage {
  abstract concat(chunk: BaseMessageChunk): BaseMessageChunk;

  static _mergeAdditionalKwargs(
    left: NonNullable<BaseMessageFields["additional_kwargs"]>,
    right: NonNullable<BaseMessageFields["additional_kwargs"]>
  ): NonNullable<BaseMessageFields["additional_kwargs"]> {
    const merged = { ...left };
    for (const [key, value] of Object.entries(right)) {
      if (merged[key] === undefined) {
        merged[key] = value;
      } else if (typeof merged[key] !== typeof value) {
        throw new Error(
          `additional_kwargs[${key}] already exists in the message chunk, but with a different type.`
        );
      } else if (typeof merged[key] === "string") {
        merged[key] = (merged[key] as string) + value;
      } else if (
        !Array.isArray(merged[key]) &&
        typeof merged[key] === "object"
      ) {
        merged[key] = this._mergeAdditionalKwargs(
          merged[key] as NonNullable<BaseMessageFields["additional_kwargs"]>,
          value as NonNullable<BaseMessageFields["additional_kwargs"]>
        );
      } else if (
        key === "tool_calls" &&
        isOpenAIToolCallArray(merged[key]) &&
        isOpenAIToolCallArray(value)
      ) {
        for (const toolCall of value) {
          if (merged[key]?.[toolCall.index] !== undefined) {
            merged[key] = merged[key]?.map((value, i) => {
              if (i !== toolCall.index) {
                return value;
              }
              return {
                ...value,
                ...toolCall,
                function: {
                  name: toolCall.function.name ?? value.function.name,
                  arguments:
                    (value.function.arguments ?? "") +
                    (toolCall.function.arguments ?? ""),
                },
              };
            });
          } else {
            (merged[key] as OpenAIToolCall[])[toolCall.index] = toolCall;
          }
        }
      } else {
        throw new Error(
          `additional_kwargs[${key}] already exists in this message chunk.`
        );
      }
    }
    return merged;
  }
}

/**
 * Represents a human message in a conversation.
 */
export class HumanMessage extends BaseMessage {
  static lc_name() {
    return "HumanMessage";
  }

  _getType(): MessageType {
    return "human";
  }
}

/**
 * Represents a chunk of a human message, which can be concatenated with
 * other human message chunks.
 */
export class HumanMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "HumanMessageChunk";
  }

  _getType(): MessageType {
    return "human";
  }

  concat(chunk: HumanMessageChunk) {
    return new HumanMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: HumanMessageChunk._mergeAdditionalKwargs(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
    });
  }
}

/**
 * Represents an AI message in a conversation.
 */
export class AIMessage extends BaseMessage {
  static lc_name() {
    return "AIMessage";
  }

  _getType(): MessageType {
    return "ai";
  }
}

/**
 * Represents a chunk of an AI message, which can be concatenated with
 * other AI message chunks.
 */
export class AIMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "AIMessageChunk";
  }

  _getType(): MessageType {
    return "ai";
  }

  concat(chunk: AIMessageChunk) {
    return new AIMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: AIMessageChunk._mergeAdditionalKwargs(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
    });
  }
}

/**
 * Represents a system message in a conversation.
 */
export class SystemMessage extends BaseMessage {
  static lc_name() {
    return "SystemMessage";
  }

  _getType(): MessageType {
    return "system";
  }
}

/**
 * Represents a chunk of a system message, which can be concatenated with
 * other system message chunks.
 */
export class SystemMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "SystemMessageChunk";
  }

  _getType(): MessageType {
    return "system";
  }

  concat(chunk: SystemMessageChunk) {
    return new SystemMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: SystemMessageChunk._mergeAdditionalKwargs(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
    });
  }
}

/**
 * Represents a function message in a conversation.
 */
export class FunctionMessage extends BaseMessage {
  static lc_name() {
    return "FunctionMessage";
  }

  constructor(fields: FunctionMessageFieldsWithName);

  constructor(
    fields: string | BaseMessageFields,
    /** @deprecated */
    name: string
  );

  constructor(
    fields: string | FunctionMessageFieldsWithName,
    /** @deprecated */
    name?: string
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, name: name! };
    }
    super(fields);
  }

  _getType(): MessageType {
    return "function";
  }
}

/**
 * Represents a chunk of a function message, which can be concatenated
 * with other function message chunks.
 */
export class FunctionMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "FunctionMessageChunk";
  }

  _getType(): MessageType {
    return "function";
  }

  concat(chunk: FunctionMessageChunk) {
    return new FunctionMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: FunctionMessageChunk._mergeAdditionalKwargs(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      name: this.name ?? "",
    });
  }
}

/**
 * Represents a tool message in a conversation.
 */
export class ToolMessage extends BaseMessage {
  static lc_name() {
    return "ToolMessage";
  }

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return { tool_call_id: "tool_call_id" };
  }

  tool_call_id: string;

  constructor(fields: ToolMessageFieldsWithToolCallId);

  constructor(
    fields: string | BaseMessageFields,
    tool_call_id: string,
    name?: string
  );

  constructor(
    fields: string | ToolMessageFieldsWithToolCallId,
    tool_call_id?: string,
    name?: string
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, name, tool_call_id: tool_call_id! };
    }
    super(fields);
    this.tool_call_id = fields.tool_call_id;
  }

  _getType(): MessageType {
    return "tool";
  }
}

/**
 * Represents a chunk of a tool message, which can be concatenated
 * with other tool message chunks.
 */
export class ToolMessageChunk extends BaseMessageChunk {
  tool_call_id: string;

  constructor(fields: ToolMessageFieldsWithToolCallId) {
    super(fields);
    this.tool_call_id = fields.tool_call_id;
  }

  static lc_name() {
    return "ToolMessageChunk";
  }

  _getType(): MessageType {
    return "tool";
  }

  concat(chunk: ToolMessageChunk) {
    return new ToolMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: ToolMessageChunk._mergeAdditionalKwargs(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      tool_call_id: this.tool_call_id,
    });
  }
}

/**
 * Represents a chat message in a conversation.
 */
export class ChatMessage
  extends BaseMessage
  implements ChatMessageFieldsWithRole
{
  static lc_name() {
    return "ChatMessage";
  }

  role: string;

  _chatMessageClass = ChatMessage;

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

  static isInstance(message: BaseMessage): message is ChatMessage {
    return message._getType() === "generic";
  }
}

export type BaseMessageLike =
  | BaseMessage
  | [StringWithAutocomplete<MessageType | "user" | "assistant">, MessageContent]
  | string;

export function isBaseMessage(
  messageLike?: unknown
): messageLike is BaseMessage {
  return typeof (messageLike as BaseMessage)?._getType === "function";
}

export function isBaseMessageChunk(
  messageLike?: unknown
): messageLike is BaseMessageChunk {
  return (
    isBaseMessage(messageLike) &&
    typeof (messageLike as BaseMessageChunk).concat === "function"
  );
}

export function coerceMessageLikeToMessage(
  messageLike: BaseMessageLike
): BaseMessage {
  if (typeof messageLike === "string") {
    return new HumanMessage(messageLike);
  } else if (isBaseMessage(messageLike)) {
    return messageLike;
  }
  const [type, content] = messageLike;
  if (type === "human" || type === "user") {
    return new HumanMessage({ content });
  } else if (type === "ai" || type === "assistant") {
    return new AIMessage({ content });
  } else if (type === "system") {
    return new SystemMessage({ content });
  } else {
    throw new Error(
      `Unable to coerce message from array: only human, AI, or system message coercion is currently supported.`
    );
  }
}

/**
 * Represents a chunk of a chat message, which can be concatenated with
 * other chat message chunks.
 */
export class ChatMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "ChatMessageChunk";
  }

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

  concat(chunk: ChatMessageChunk) {
    return new ChatMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: ChatMessageChunk._mergeAdditionalKwargs(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      role: this.role,
    });
  }
}

/**
 * This function is used by memory classes to get a string representation
 * of the chat message history, based on the message content and role.
 */
export function getBufferString(
  messages: BaseMessage[],
  humanPrefix = "Human",
  aiPrefix = "AI"
): string {
  const string_messages: string[] = [];
  for (const m of messages) {
    let role: string;
    if (m._getType() === "human") {
      role = humanPrefix;
    } else if (m._getType() === "ai") {
      role = aiPrefix;
    } else if (m._getType() === "system") {
      role = "System";
    } else if (m._getType() === "function") {
      role = "Function";
    } else if (m._getType() === "tool") {
      role = "Tool";
    } else if (m._getType() === "generic") {
      role = (m as ChatMessage).role;
    } else {
      throw new Error(`Got unsupported message type: ${m._getType()}`);
    }
    const nameStr = m.name ? `${m.name}, ` : "";
    string_messages.push(`${role}: ${nameStr}${m.content}`);
  }
  return string_messages.join("\n");
}

/**
 * Maps messages from an older format (V1) to the current `StoredMessage`
 * format. If the message is already in the `StoredMessage` format, it is
 * returned as is. Otherwise, it transforms the V1 message into a
 * `StoredMessage`. This function is important for maintaining
 * compatibility with older message formats.
 */
function mapV1MessageToStoredMessage(
  message: StoredMessage | StoredMessageV1
): StoredMessage {
  // TODO: Remove this mapper when we deprecate the old message format.
  if ((message as StoredMessage).data !== undefined) {
    return message as StoredMessage;
  } else {
    const v1Message = message as StoredMessageV1;
    return {
      type: v1Message.type,
      data: {
        content: v1Message.text,
        role: v1Message.role,
        name: undefined,
        tool_call_id: undefined,
      },
    };
  }
}

export function mapStoredMessageToChatMessage(message: StoredMessage) {
  const storedMessage = mapV1MessageToStoredMessage(message);
  switch (storedMessage.type) {
    case "human":
      return new HumanMessage(storedMessage.data);
    case "ai":
      return new AIMessage(storedMessage.data);
    case "system":
      return new SystemMessage(storedMessage.data);
    case "function":
      if (storedMessage.data.name === undefined) {
        throw new Error("Name must be defined for function messages");
      }
      return new FunctionMessage(
        storedMessage.data as FunctionMessageFieldsWithName
      );
    case "tool":
      if (storedMessage.data.tool_call_id === undefined) {
        throw new Error("Tool call ID must be defined for tool messages");
      }
      return new ToolMessage(
        storedMessage.data as ToolMessageFieldsWithToolCallId
      );
    case "chat": {
      if (storedMessage.data.role === undefined) {
        throw new Error("Role must be defined for chat messages");
      }
      return new ChatMessage(storedMessage.data as ChatMessageFieldsWithRole);
    }
    default:
      throw new Error(`Got unexpected type: ${storedMessage.type}`);
  }
}

/**
 * Transforms an array of `StoredMessage` instances into an array of
 * `BaseMessage` instances. It uses the `mapV1MessageToStoredMessage`
 * function to ensure all messages are in the `StoredMessage` format, then
 * creates new instances of the appropriate `BaseMessage` subclass based
 * on the type of each message. This function is used to prepare stored
 * messages for use in a chat context.
 */
export function mapStoredMessagesToChatMessages(
  messages: StoredMessage[]
): BaseMessage[] {
  return messages.map(mapStoredMessageToChatMessage);
}

/**
 * Transforms an array of `BaseMessage` instances into an array of
 * `StoredMessage` instances. It does this by calling the `toDict` method
 * on each `BaseMessage`, which returns a `StoredMessage`. This function
 * is used to prepare chat messages for storage.
 */
export function mapChatMessagesToStoredMessages(
  messages: BaseMessage[]
): StoredMessage[] {
  return messages.map((message) => message.toDict());
}
