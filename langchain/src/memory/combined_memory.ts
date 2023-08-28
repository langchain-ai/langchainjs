import {
  InputValues,
  MemoryVariables,
  BaseMemory,
  OutputValues,
} from "./base.js";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

/**
 * Interface that defines the shape of the input object that the
 * CombinedMemory constructor accepts. It extends the BaseChatMemoryInput
 * interface and adds additional properties.
 */
export interface CombinedMemoryInput extends BaseChatMemoryInput {
  memories: BaseMemory[];
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
}

/**
 * Class that manages and manipulates previous chat messages. It extends
 * from the BaseChatMemory class and implements the CombinedMemoryInput
 * interface.
 */
export class CombinedMemory
  extends BaseChatMemory
  implements CombinedMemoryInput
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  memories: BaseMemory[] = [];

  constructor(fields?: CombinedMemoryInput) {
    super({
      chatHistory: fields?.chatHistory,
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });

    this.memories = fields?.memories ?? this.memories;
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.checkRepeatedMemoryVariable();
    this.checkInputKey();
  }

  /**
   * Checks for repeated memory variables across all memory objects. Throws
   * an error if any are found.
   */
  checkRepeatedMemoryVariable() {
    const allVariables: string[] = [];
    for (const memory of this.memories) {
      const overlap = allVariables.filter((x) => memory.memoryKeys.includes(x));
      if (overlap.length > 0) {
        throw new Error(
          `The same variables ${[
            ...overlap,
          ]} are found in multiple memory objects, which is not allowed by CombinedMemory.`
        );
      }
      allVariables.push(...memory.memoryKeys);
    }
  }

  /**
   * Checks if input keys are set for all memory objects. Logs a warning if
   * any are missing.
   */
  checkInputKey() {
    for (const memory of this.memories) {
      if (
        (memory as BaseChatMemory).chatHistory !== undefined &&
        (memory as BaseChatMemory).inputKey === undefined
      ) {
        console.warn(
          `When using CombinedMemory, input keys should be set so the input is known. Was not set on ${memory}.`
        );
      }
    }
  }

  /**
   * Loads memory variables from all memory objects.
   * @param inputValues Input values to load memory variables from.
   * @returns Promise that resolves with an object containing the loaded memory variables.
   */
  async loadMemoryVariables(
    inputValues: InputValues
  ): Promise<MemoryVariables> {
    let memoryData: Record<string, unknown> = {};

    for (const memory of this.memories) {
      const data = await memory.loadMemoryVariables(inputValues);
      memoryData = {
        ...memoryData,
        ...data,
      };
    }
    return memoryData;
  }

  /**
   * Saves the context to all memory objects.
   * @param inputValues Input values to save.
   * @param outputValues Output values to save.
   * @returns Promise that resolves when the context has been saved to all memory objects.
   */
  async saveContext(inputValues: InputValues, outputValues: OutputValues) {
    for (const memory of this.memories) {
      await memory.saveContext(inputValues, outputValues);
    }
  }

  /**
   * Clears all memory objects.
   * @returns Promise that resolves when all memory objects have been cleared.
   */
  async clear() {
    for (const memory of this.memories) {
      if (typeof (memory as BaseChatMemory).clear === "function") {
        await (memory as BaseChatMemory).clear();
      }
    }
  }

  get memoryKeys() {
    const memoryKeys: string[] = [];
    for (const memory of this.memories) {
      memoryKeys.push(...memory.memoryKeys);
    }
    return memoryKeys;
  }
}
