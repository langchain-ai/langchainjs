import { InputValues, MemoryVariables, getBufferString } from "./base.js";

import { BaseChatMemory, BaseMemoryInput } from "./chat_memory.js";

export interface BufferWindowMemoryInput<I extends string, O extends string>
  extends BaseMemoryInput<I, O> {
  memoryKey: "history";
  k: number;

  // FIXME: Are these used anywhere?
  //
  // Should these be passed to `getBufferString`?
  humanPrefix: string;
  aiPrefix: string;
}

export class BufferWindowMemory<I extends string, O extends string>
  extends BaseChatMemory<"history", I, O>
  implements BufferWindowMemoryInput<I, O>
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history" as const;

  k = 5;

  constructor(fields?: Partial<BufferWindowMemoryInput<I, O>>) {
    super({ returnMessages: fields?.returnMessages ?? false });
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.k = fields?.k ?? this.k;
  }

  async loadMemoryVariables(
    _values: InputValues<I>
  ): Promise<MemoryVariables<"history">> {
    // FIXME: This should return Record<"history", BaseChatMessage[] | string[]>
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
