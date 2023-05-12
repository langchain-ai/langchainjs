import {
  AIChatMessage,
  BaseChatMessage,
  ChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "../../schema/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdditionalKwargs = Record<string, any>;
export interface StoredMessageData {
  content: string;
  role: string | undefined;
  additional_kwargs?: AdditionalKwargs;
}

export interface StoredMessage {
  type: string;
  data: StoredMessageData;
}

interface StoredMessageV1 {
  type: string;
  role: string | undefined;
  text: string;
}

export function mapV1MessageToStoredMessage(
  message: StoredMessage | StoredMessageV1
): StoredMessage {
  if ("data" in message) {
    return message as StoredMessage;
  } else {
    const v1Message = message as StoredMessageV1;
    return {
      type: v1Message.type,
      data: {
        content: v1Message.text,
        role: v1Message.role,
      },
    };
  }
}

export function mapStoredMessagesToChatMessages(
  messages: StoredMessage[]
): BaseChatMessage[] {
  return messages.map((message) => {
    const stored_msg = mapV1MessageToStoredMessage(message);
    switch (stored_msg.type) {
      case "human":
        return new HumanChatMessage(stored_msg.data.content);
      case "ai":
        return new AIChatMessage(stored_msg.data.content);
      case "system":
        return new SystemChatMessage(stored_msg.data.content);
      case "chat":
        if (stored_msg.data?.additional_kwargs?.role === undefined) {
          throw new Error("Role must be defined for chat messages");
        }
        return new ChatMessage(
          stored_msg.data.content,
          stored_msg.data.additional_kwargs.role
        );
      default:
        throw new Error(`Got unexpected type: ${stored_msg.type}`);
    }
  });
}

export function mapChatMessagesToStoredMessages(
  messages: BaseChatMessage[]
): StoredMessage[] {
  return messages.map((message) => ({
    type: message._getType(),
    data: {
      content: message.text,
      role: "role" in message ? (message.role as string) : undefined,
    },
  }));
}
