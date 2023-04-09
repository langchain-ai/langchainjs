import { InputValues, MemoryVariables, getBufferString } from "./base.js";

import { BaseChatMemory, BaseMemoryInput } from "./chat_memory.js";

export interface BufferWindowMemoryInput<
  I extends string,
  O extends string,
  MI extends string
> extends BaseMemoryInput<I, O> {
  memoryKey: MI;
  k: number;

  // FIXME: Are these used anywhere?
  //
  // Should these be passed to `getBufferString`?
  humanPrefix: string;
  aiPrefix: string;
}

export class BufferWindowMemory<
    I extends string,
    O extends string,
    MI extends string
  >
  extends BaseChatMemory<I, O, MI>
  implements BufferWindowMemoryInput<I, O, MI>
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey: MI = "history" as MI;

  k = 5;

  constructor(fields?: Partial<BufferWindowMemoryInput<I, O, MI>>) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      chatHistory: fields?.chatHistory,
    });
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.k = fields?.k ?? this.k;
  }

  async loadMemoryVariables(
    _values: InputValues<I>
  ): Promise<MemoryVariables<MI>> {
    // FIXME: This should return Record<"history", BaseChatMessage[] | string[]>
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: this.chatHistory.messages.slice(-this.k * 2),
      } as MemoryVariables<MI>;
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(
        this.chatHistory.messages.slice(-this.k * 2)
      ),
    } as MemoryVariables<MI>;
    return result;
  }
}
