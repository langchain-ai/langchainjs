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

export function mapStoredMessagesToChatMessages(
  messages: StoredMessage[]
): BaseChatMessage[] {
  return messages.map((message) => {
    switch (message.type) {
      case "human":
        return new HumanChatMessage(message.data.content);
      case "ai":
        return new AIChatMessage(message.data.content);
      case "system":
        return new SystemChatMessage(message.data.content);
      case "chat":
        if (message.data?.additional_kwargs?.role === undefined) {
          throw new Error("Role must be defined for chat messages");
        }
        return new ChatMessage(
          message.data.content,
          message.data.additional_kwargs.role
        );
      default:
        throw new Error(`Got unexpected type: ${message.type}`);
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
