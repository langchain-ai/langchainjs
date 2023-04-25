import { InputValues, MemoryVariables, getBufferString } from "./base.js";

import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

export interface BufferWindowMemoryInput extends BaseChatMemoryInput {
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
  k?: number;
}

export class BufferWindowMemory
  extends BaseChatMemory
  implements BufferWindowMemoryInput
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  k = 5;

  constructor(fields?: BufferWindowMemoryInput) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      chatHistory: fields?.chatHistory,
    });
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.k = fields?.k ?? this.k;
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const messages = await this.chatHistory.getMessages();
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: messages.slice(-this.k * 2),
      };
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(messages.slice(-this.k * 2)),
    };
    return result;
  }
}
