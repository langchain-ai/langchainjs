import {
  HumanChatMessage,
  AIChatMessage,
  BaseChatMessage,
  BaseChatMessageHistory,
} from "../../schema/index.js";

export class ChatMessageHistory extends BaseChatMessageHistory {
  private messages: BaseChatMessage[] = [];

  constructor(messages?: BaseChatMessage[]) {
    super();
    this.messages = messages ?? [];
  }

  async getMessages(): Promise<BaseChatMessage[]> {
    return this.messages;
  }

  async addUserMessage(message: string) {
    this.messages.push(new HumanChatMessage(message));
  }

  async addAIChatMessage(message: string) {
    this.messages.push(new AIChatMessage(message));
  }

  async clear() {
    this.messages = [];
  }
}
