import { BaseMemory, InputValues, MemoryVariables, OutputValues } from "./base";

export interface BufferWindowMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  memoryKey: string;
  k: number;
}

const getInputValue = (inputValues: InputValues) => {
  const keys = Object.keys(inputValues);
  if (keys.length === 1) {
    return inputValues[keys[0]];
  }
  throw new Error(
    "input values have multiple keys, memory only supported when one key currently"
  );
};

export class BufferWindowMemory
  extends BaseMemory
  implements BufferWindowMemoryInput
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  buffer: string[] = [];

  k = 5;

  constructor(fields?: Partial<BufferWindowMemoryInput>) {
    super();
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.k = fields?.k ?? this.k;
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const result = {
      [this.memoryKey]: this.buffer.slice(-this.k).join("\n\n"),
    };
    return result;
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: Promise<OutputValues>
  ): Promise<void> {
    const values = await outputValues;
    const human = `${this.humanPrefix}: ${getInputValue(inputValues)}`;
    const ai = `${this.aiPrefix}: ${getInputValue(values)}`;
    const newlines = [human, ai];
    this.buffer.push(`\n${newlines.join("\n")}`);
  }
}
