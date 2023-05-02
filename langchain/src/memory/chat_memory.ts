import { BaseChatMessageHistory } from "../schema/index.js";
import {
  BaseMemory,
  InputValues,
  OutputValues,
  getInputValue,
} from "./base.js";
import { ChatMessageHistory } from "../stores/message/in_memory.js";

export interface BaseChatMemoryInput {
  chatHistory?: BaseChatMessageHistory;
  returnMessages?: boolean;
  inputKey?: string;
  outputKey?: string;
}

export abstract class BaseChatMemory extends BaseMemory {
  chatHistory: BaseChatMessageHistory;

  returnMessages = false;

  inputKey?: string;

  outputKey?: string;

  constructor(fields?: BaseChatMemoryInput) {
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
    // this is purposefully done in sequence so they're saved in order
    await this.chatHistory.addUserMessage(
      getInputValue(inputValues, this.inputKey)
    );
    await this.chatHistory.addAIChatMessage(
      getInputValue(outputValues, this.outputKey)
    );
  }

  async clear(): Promise<void> {
    await this.chatHistory.clear();
  }
}
