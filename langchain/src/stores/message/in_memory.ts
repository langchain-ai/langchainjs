import {
  BaseChatMessage,
  BaseListChatMessageHistory,
} from "../../schema/index.js";

export class ChatMessageHistory extends BaseListChatMessageHistory {
  private messages: BaseChatMessage[] = [];

  constructor(messages?: BaseChatMessage[]) {
    super();
    this.messages = messages ?? [];
  }

  async getMessages(): Promise<BaseChatMessage[]> {
    return this.messages;
  }

  async addMessage(message: BaseChatMessage) {
    this.messages.push(message);
  }

  async clear() {
    this.messages = [];
  }
}
