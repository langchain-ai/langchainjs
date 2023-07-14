import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  ChatMessageFieldsWithRole,
  HumanMessage,
  StoredMessage,
  SystemMessage,
} from "../../schema/index.js";

interface StoredMessageV1 {
  type: string;
  role: string | undefined;
  text: string;
}

export function mapV1MessageToStoredMessage(
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
      },
    };
  }
}

export function mapStoredMessagesToChatMessages(
  messages: StoredMessage[]
): BaseMessage[] {
  return messages.map((message) => {
    const storedMessage = mapV1MessageToStoredMessage(message);
    switch (storedMessage.type) {
      case "human":
        return new HumanMessage(storedMessage.data);
      case "ai":
        return new AIMessage(storedMessage.data);
      case "system":
        return new SystemMessage(storedMessage.data);
      case "chat": {
        if (storedMessage.data.role === undefined) {
          throw new Error("Role must be defined for chat messages");
        }
        return new ChatMessage(storedMessage.data as ChatMessageFieldsWithRole);
      }
      default:
        throw new Error(`Got unexpected type: ${storedMessage.type}`);
    }
  });
}

export function mapChatMessagesToStoredMessages(
  messages: BaseMessage[]
): StoredMessage[] {
  return messages.map((message) => message.toDict());
}
