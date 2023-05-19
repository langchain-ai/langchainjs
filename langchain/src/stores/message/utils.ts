import {
  AIChatMessage,
  BaseChatMessage,
  HumanChatMessage,
  MessageType,
  StoredMessage,
  SystemChatMessage
} from '../../schema/index.js'

interface StoredMessageV1 {
  type: MessageType;
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
      },
    };
  }
}

export function mapStoredMessagesToChatMessages(
  messages: StoredMessage[]
): BaseChatMessage[] {
  return messages.map((message) => {
    const storedMessage = mapV1MessageToStoredMessage(message);
    switch (storedMessage.type) {
      case "human":
        return new HumanChatMessage(storedMessage.data.content);
      case "ai":
        return new AIChatMessage(storedMessage.data.content);
      case "system":
        return new SystemChatMessage(storedMessage.data.content);
      default:
        throw new Error(`Got unexpected type: ${storedMessage.type}`);
    }
  });
}

export function mapChatMessagesToStoredMessages(
  messages: BaseChatMessage[]
): StoredMessage[] {
  return messages.map((message) => message.toJSON());
}
