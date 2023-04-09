import { InputValues, MemoryVariables, getBufferString } from "./base.js";
import { BaseChatMemory, BaseMemoryInput } from "./chat_memory.js";

export interface BufferMemoryInput<
  I extends string,
  O extends string,
  MI extends string
> extends BaseMemoryInput<I, O> {
  memoryKey: MI;

  // FIXME: Are these used anywhere?
  //
  // Should these be passed to `getBufferString`?
  humanPrefix: string;
  aiPrefix: string;
}

export class BufferMemory<I extends string, O extends string, MI extends string>
  extends BaseChatMemory<I, O, MI>
  implements BufferMemoryInput<I, O, MI>
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey: MI = "history" as MI;

  constructor(fields?: Partial<BufferMemoryInput<I, O, MI>>) {
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

  async loadMemoryVariables(
    _values: InputValues<I>
  ): Promise<MemoryVariables<MI>> {
    // FIXME: This should return Record<"history", BaseChatMessage[] | string[]>
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: this.chatHistory.messages,
      } as MemoryVariables<MI>;
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(this.chatHistory.messages),
    } as MemoryVariables<MI>;
    return result;
  }
}
