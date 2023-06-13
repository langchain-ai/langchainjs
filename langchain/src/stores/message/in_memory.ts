import {
  BaseChatMessage,
  BaseListChatMessageHistory,
} from "../../schema/index.js";

export class ChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "in_memory"];

  private messages: BaseChatMessage[] = [];

  constructor(messages?: BaseChatMessage[]) {
    super(...arguments);
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
