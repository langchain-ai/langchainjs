import { InputValues, MemoryVariables, getBufferString } from "./base.js";
import { BaseChatMemory, BaseMemoryInput } from "./chat_memory.js";

export interface BufferMemoryInput extends BaseMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  memoryKey: string;
}

export class BufferMemory extends BaseChatMemory implements BufferMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  constructor(fields?: Partial<BufferMemoryInput>) {
    super({
      chatHistory: fields?.chatHistory,
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: this.chatHistory.messages,
      };
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(this.chatHistory.messages),
    };
    return result;
  }
}
