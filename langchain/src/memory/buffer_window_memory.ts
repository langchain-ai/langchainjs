import { InputValues, MemoryVariables, getBufferString } from "./base.js";

import { BaseChatMemory, BaseMemoryInput } from "./chat_memory.js";

export interface BufferWindowMemoryInput extends BaseMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  memoryKey: string;
  k: number;
}

export class BufferWindowMemory
  extends BaseChatMemory
  implements BufferWindowMemoryInput
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  k = 5;

  constructor(fields?: Partial<BufferWindowMemoryInput>) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      chatHistory: fields?.chatHistory,
    });
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.k = fields?.k ?? this.k;
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: this.chatHistory.messages.slice(-this.k * 2),
      };
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(
        this.chatHistory.messages.slice(-this.k * 2)
      ),
    };
    return result;
  }
}
