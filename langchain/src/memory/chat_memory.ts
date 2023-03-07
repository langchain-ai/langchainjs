import {
  HumanChatMessage,
  AIChatMessage,
  BaseChatMessage,
} from "../schema/index.js";
import {
  BaseMemory,
  InputValues,
  OutputValues,
  getInputValue,
} from "./base.js";

export class ChatMessageHistory {
  messages: BaseChatMessage[] = [];

  constructor(messages?: BaseChatMessage[]) {
    this.messages = messages ?? [];
  }

  addUserMessage(message: string): void {
    this.messages.push(new HumanChatMessage(message));
  }

  addAIChatMessage(message: string): void {
    this.messages.push(new AIChatMessage(message));
  }
}

export abstract class BaseChatMemory extends BaseMemory {
  chatHistory: ChatMessageHistory;

  constructor(chatHistory?: ChatMessageHistory) {
    super();
    this.chatHistory = chatHistory ?? new ChatMessageHistory();
  }

  async saveContext(
    inputValues: InputValues,
    OutputValues: Promise<OutputValues>
  ): Promise<void> {
    const values = await OutputValues;
    this.chatHistory.addUserMessage(getInputValue(inputValues));
    this.chatHistory.addAIChatMessage(getInputValue(values));
  }
}
