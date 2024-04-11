import {
  BaseMessageLike,
  BaseMessage,
  isBaseMessage,
  StoredMessage,
  StoredMessageV1,
} from "./base.js";
import { HumanMessage, HumanMessageChunk } from "./human.js";
import { AIMessage, AIMessageChunk } from "./ai.js";
import { SystemMessage, SystemMessageChunk } from "./system.js";
import {
  ChatMessage,
  ChatMessageChunk,
  ChatMessageFieldsWithRole,
} from "./chat.js";
import {
  FunctionMessage,
  FunctionMessageChunk,
  FunctionMessageFieldsWithName,
} from "./function.js";
import { ToolMessage, ToolMessageFieldsWithToolCallId } from "./tool.js";

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

export function convertToChunk(message: BaseMessage) {
  const type = message._getType();
  if (type === "human") {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new HumanMessageChunk({ ...message });
  } else if (type === "ai") {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new AIMessageChunk({ ...message });
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
