import {
  BaseMemory,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "./base.js";

export interface BufferMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  memoryKey: string;
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

export class BufferMemory extends BaseMemory implements BufferMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  buffer = "";

  constructor(fields?: Partial<BufferMemoryInput>) {
    super();
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const result = { [this.memoryKey]: this.buffer };
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
    this.buffer += `\n${newlines.join("\n")}`;
  }
}
