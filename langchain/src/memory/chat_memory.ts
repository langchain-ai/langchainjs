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
  MemoryVariables,
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

export abstract class ChatMemoryMixin extends BaseMemory {
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

export interface ChatMemoryInput {
  memoryKey: string;
  k?: number;
}

export class ChatMessageMemory
  extends ChatMemoryMixin
  implements ChatMemoryInput
{
  memoryKey = "history";

  k?: number = undefined;

  constructor(fields?: Partial<ChatMemoryInput>) {
    super();
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.k = fields?.k ?? this.k;
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    let { messages } = this.chatHistory;
    if (this.k) {
      messages = messages.slice(-this.k);
    }
    const result = {
      [this.memoryKey]: messages,
    };
    return result;
  }
}
