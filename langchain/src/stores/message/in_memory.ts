import { BaseMessage, BaseListChatMessageHistory } from "../../schema/index.js";

export class ChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "in_memory"];

  private messages: BaseMessage[] = [];

  constructor(messages?: BaseMessage[]) {
    super(...arguments);
    this.messages = messages ?? [];
  }

  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }

  async addMessage(message: BaseMessage) {
    this.messages.push(message);
  }

  async clear() {
    this.messages = [];
  }
}
