import { addLangChainErrorFields } from "../errors/index.js";
import { SerializedConstructor } from "../load/serializable.js";
import { _isToolCall } from "../tools/utils.js";
import { AIMessage, AIMessageChunk, AIMessageChunkFields } from "./ai.js";
import {
  BaseMessageLike,
  BaseMessage,
  isBaseMessage,
  StoredMessage,
  StoredMessageV1,
  BaseMessageFields,
  _isMessageFieldWithRole,
} from "./base.js";
import {
  ChatMessage,
  ChatMessageFieldsWithRole,
  ChatMessageChunk,
} from "./chat.js";
import {
  FunctionMessage,
  FunctionMessageFieldsWithName,
  FunctionMessageChunk,
} from "./function.js";
import { HumanMessage, HumanMessageChunk } from "./human.js";
import { SystemMessage, SystemMessageChunk } from "./system.js";
import {
  ToolCall,
  ToolMessage,
  ToolMessageFieldsWithToolCallId,
} from "./tool.js";

function _coerceToolCall(
  toolCall: ToolCall | Record<string, unknown>
): ToolCall {
  if (_isToolCall(toolCall)) {
    return toolCall;
  } else if (
    typeof toolCall.id === "string" &&
    toolCall.type === "function" &&
    typeof toolCall.function === "object" &&
    toolCall.function !== null &&
    "arguments" in toolCall.function &&
    typeof toolCall.function.arguments === "string" &&
    "name" in toolCall.function &&
    typeof toolCall.function.name === "string"
  ) {
    // Handle OpenAI tool call format
    return {
      id: toolCall.id,
      args: JSON.parse(toolCall.function.arguments),
      name: toolCall.function.name,
      type: "tool_call",
    };
  } else {
    // TODO: Throw an error?
    return toolCall as ToolCall;
  }
}

function isSerializedConstructor(x: unknown): x is SerializedConstructor {
  return (
    typeof x === "object" &&
    x != null &&
    (x as SerializedConstructor).lc === 1 &&
    Array.isArray((x as SerializedConstructor).id) &&
    (x as SerializedConstructor).kwargs != null &&
    typeof (x as SerializedConstructor).kwargs === "object"
  );
}

function _constructMessageFromParams(
  params:
    | (BaseMessageFields & { type: string } & Record<string, unknown>)
    | SerializedConstructor
) {
  let type: string;
  let rest: BaseMessageFields & Record<string, unknown>;
  // Support serialized messages
  if (isSerializedConstructor(params)) {
    const className = params.id.at(-1);
    if (className === "HumanMessage" || className === "HumanMessageChunk") {
      type = "user";
    } else if (className === "AIMessage" || className === "AIMessageChunk") {
      type = "assistant";
    } else if (
      className === "SystemMessage" ||
      className === "SystemMessageChunk"
    ) {
      type = "system";
    } else if (
      className === "FunctionMessage" ||
      className === "FunctionMessageChunk"
    ) {
      type = "function";
    } else if (
      className === "ToolMessage" ||
      className === "ToolMessageChunk"
    ) {
      type = "tool";
    } else {
      type = "unknown";
    }
    rest = params.kwargs as BaseMessageFields;
  } else {
    const { type: extractedType, ...otherParams } = params;
    type = extractedType;
    rest = otherParams;
  }
  if (type === "human" || type === "user") {
    return new HumanMessage(rest);
  } else if (type === "ai" || type === "assistant") {
    const { tool_calls: rawToolCalls, ...other } = rest;
    if (!Array.isArray(rawToolCalls)) {
      return new AIMessage(rest);
    }
    const tool_calls = rawToolCalls.map(_coerceToolCall);
    return new AIMessage({ ...other, tool_calls });
  } else if (type === "system") {
    return new SystemMessage(rest);
  } else if (type === "developer") {
    return new SystemMessage({
      ...rest,
      additional_kwargs: {
        ...rest.additional_kwargs,
        __openai_role__: "developer",
      },
    });
  } else if (type === "tool" && "tool_call_id" in rest) {
    return new ToolMessage({
      ...rest,
      content: rest.content,
      tool_call_id: rest.tool_call_id as string,
      name: rest.name,
    });
  } else {
    const error = addLangChainErrorFields(
      new Error(
        `Unable to coerce message from array: only human, AI, system, developer, or tool message coercion is currently supported.\n\nReceived: ${JSON.stringify(
          params,
          null,
          2
        )}`
      ),
      "MESSAGE_COERCION_FAILURE"
    );
    throw error;
  }
}

export function coerceMessageLikeToMessage(
  messageLike: BaseMessageLike
): BaseMessage {
  if (typeof messageLike === "string") {
    return new HumanMessage(messageLike);
  } else if (isBaseMessage(messageLike)) {
    return messageLike;
  }
  if (Array.isArray(messageLike)) {
    const [type, content] = messageLike;
    return _constructMessageFromParams({ type, content });
  } else if (_isMessageFieldWithRole(messageLike)) {
    const { role: type, ...rest } = messageLike;
    return _constructMessageFromParams({ ...rest, type });
  } else {
    return _constructMessageFromParams(messageLike);
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
    const readableContent =
      typeof m.content === "string"
        ? m.content
        : JSON.stringify(m.content, null, 2);
    string_messages.push(`${role}: ${nameStr}${readableContent}`);
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
    case "generic": {
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

export function convertToChunk(message: BaseMessage) {
  const type = message._getType();
  if (type === "human") {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new HumanMessageChunk({ ...message });
  } else if (type === "ai") {
    let aiChunkFields: AIMessageChunkFields = {
      ...message,
    };
    if ("tool_calls" in aiChunkFields) {
      aiChunkFields = {
        ...aiChunkFields,
        tool_call_chunks: aiChunkFields.tool_calls?.map((tc) => ({
          ...tc,
          type: "tool_call_chunk",
          index: undefined,
          args: JSON.stringify(tc.args),
        })),
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new AIMessageChunk({ ...aiChunkFields });
  } else if (type === "system") {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new SystemMessageChunk({ ...message });
  } else if (type === "function") {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new FunctionMessageChunk({ ...message });
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
  } else if (ChatMessage.isInstance(message)) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new ChatMessageChunk({ ...message });
  } else {
    throw new Error("Unknown message type.");
  }
}
