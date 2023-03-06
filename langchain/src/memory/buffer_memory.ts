import { InputValues, MemoryVariables, getBufferString } from "./base.js";
import { ChatMemoryMixin } from "./chat_memory.js";

export interface BufferMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  memoryKey: string;
}

export class BufferMemory extends ChatMemoryMixin implements BufferMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  constructor(fields?: Partial<BufferMemoryInput>) {
    super();
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const result = {
      [this.memoryKey]: getBufferString(this.chatHistory.messages),
    };
    return result;
  }
}
