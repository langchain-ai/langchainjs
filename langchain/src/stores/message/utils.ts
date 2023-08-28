import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  ChatMessageFieldsWithRole,
  FunctionMessage,
  FunctionMessageFieldsWithName,
  HumanMessage,
  StoredMessage,
  SystemMessage,
} from "../../schema/index.js";

interface StoredMessageV1 {
  type: string;
  role: string | undefined;
  text: string;
}

/**
 * Maps messages from an older format (V1) to the current `StoredMessage`
 * format. If the message is already in the `StoredMessage` format, it is
 * returned as is. Otherwise, it transforms the V1 message into a
 * `StoredMessage`. This function is important for maintaining
 * compatibility with older message formats.
 */
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
  return messages.map((message) => {
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
