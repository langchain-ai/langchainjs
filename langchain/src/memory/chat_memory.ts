import {
  HumanChatMessage,
  AIChatMessage,
  BaseChatMessage,
  BaseChatMessageHistory,
} from "../schema/index.js";
import {
  BaseMemory,
  InputValues,
  OutputValues,
  getInputValue,
} from "./base.js";

export class ChatMessageHistory extends BaseChatMessageHistory {
  messages: BaseChatMessage[] = [];

  constructor(messages?: BaseChatMessage[]) {
    super();
    this.messages = messages ?? [];
  }

  addUserMessage(message: string): void {
    this.messages.push(new HumanChatMessage(message));
  }

  addAIChatMessage(message: string): void {
    this.messages.push(new AIChatMessage(message));
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
}

export interface BaseMemoryInput {
  chatHistory?: ChatMessageHistory;
  returnMessages?: boolean;
  inputKey?: string;
  outputKey?: string;
}

export abstract class BaseChatMemory extends BaseMemory {
  chatHistory: ChatMessageHistory;

  returnMessages = false;

  inputKey?: string;

  outputKey?: string;

  constructor(fields?: BaseMemoryInput) {
    super();
    this.chatHistory = fields?.chatHistory ?? new ChatMessageHistory();
    this.returnMessages = fields?.returnMessages ?? this.returnMessages;
    this.inputKey = fields?.inputKey ?? this.inputKey;
    this.outputKey = fields?.outputKey ?? this.outputKey;
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    this.chatHistory.addUserMessage(getInputValue(inputValues, this.inputKey));
    this.chatHistory.addAIChatMessage(
      getInputValue(outputValues, this.outputKey)
    );
  }

  async clear(): Promise<void> {
    await this.chatHistory.clear();
  }
}
