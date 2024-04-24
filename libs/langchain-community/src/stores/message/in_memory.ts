import { type BaseMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";

/**
 * Class for storing chat message history in-memory. It extends the
 * BaseListChatMessageHistory class and provides methods to get, add, and
 * clear messages.
 */
export class ChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "in_memory"];

  private messages: BaseMessage[] = [];

  constructor(messages?: BaseMessage[]) {
    super(...arguments);
    this.messages = messages ?? [];
  }

  /**
   * Method to get all the messages stored in the ChatMessageHistory
   * instance.
   * @returns Array of stored BaseMessage instances.
   */
  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }

  /**
   * Method to add a new message to the ChatMessageHistory instance.
   * @param message The BaseMessage instance to add.
   * @returns A promise that resolves when the message has been added.
   */
  async addMessage(message: BaseMessage) {
    this.messages.push(message);
  }

  /**
   * Method to clear all the messages from the ChatMessageHistory instance.
   * @returns A promise that resolves when all messages have been cleared.
   */
  async clear() {
    this.messages = [];
  }
}
