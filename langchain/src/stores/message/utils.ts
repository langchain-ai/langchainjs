import {
  AIChatMessage,
  BaseChatMessage,
  ChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "../../schema/index.js";

export interface StoredMessage {
  type: string;
  role: string | undefined;
  text: string;
}

export function mapStoredMessagesToChatMessages(
  messages: StoredMessage[]
): BaseChatMessage[] {
  return messages.map((message) => {
    switch (message.type) {
      case "human":
        return new HumanChatMessage(message.text);
      case "ai":
        return new AIChatMessage(message.text);
      case "system":
        return new SystemChatMessage(message.text);
      default: {
        if (message.role === undefined) {
          throw new Error("Role must be defined for generic messages");
        }
        return new ChatMessage(message.text, message.role);
      }
    }
  });
}

export function mapChatMessagesToStoredMessages(
  messages: BaseChatMessage[]
): StoredMessage[] {
  return messages.map((message) => ({
    type: message._getType(),
    role: "role" in message ? (message.role as string) : undefined,
    text: message.text,
  }));
}
