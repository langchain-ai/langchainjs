import {
  InputValues,
  MemoryVariables,
  getBufferString,
  OutputValues,
} from "./base.js";

import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";
import { BaseLanguageModel } from "../base_language/index.js";

/**
 * Interface for the input parameters of the `BufferTokenMemory` class.
 */

export interface ConversationTokenBufferMemoryInput
  extends BaseChatMemoryInput {
  /* Prefix for human messages in the buffer. */
  humanPrefix?: string;

  /* Prefix for AI messages in the buffer. */
  aiPrefix?: string;

  /* The LLM for this instance. */
  llm: BaseLanguageModel;

  /* Memory key for buffer instance. */
  memoryKey?: string;

  /* Maximmum number of tokens allowed in the buffer. */
  maxTokenLimit?: number;
}

/**
 * Class that represents a conversation chat memory with a token buffer.
 * It extends the `BaseChatMemory` class and implements the
 * `ConversationTokenBufferMemoryInput` interface.
 * @example
 * ```typescript
 * const memory = new ConversationTokenBufferMemory({
 *   llm: new ChatOpenAI({}),
 *   maxTokenLimit: 10,
 * });
 *
 * // Save conversation context
 * await memory.saveContext({ input: "hi" }, { output: "whats up" });
 * await memory.saveContext({ input: "not much you" }, { output: "not much" });
 *
 * // Load memory variables
 * const result = await memory.loadMemoryVariables({});
 * console.log(result);
 * ```
 */

export class ConversationTokenBufferMemory
  extends BaseChatMemory
  implements ConversationTokenBufferMemoryInput
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  maxTokenLimit = 2000; // Default max token limit of 2000 which can be overridden

  llm: BaseLanguageModel;

  constructor(fields: ConversationTokenBufferMemoryInput) {
    super(fields);
    this.llm = fields.llm;
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.maxTokenLimit = fields?.maxTokenLimit ?? this.maxTokenLimit;
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  /**
   * Loads the memory variables. It takes an `InputValues` object as a
   * parameter and returns a `Promise` that resolves with a
   * `MemoryVariables` object.
   * @param _values `InputValues` object.
   * @returns A `Promise` that resolves with a `MemoryVariables` object.
   */
  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const messages = await this.chatHistory.getMessages();
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: messages,
      };
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(
        messages,
        this.humanPrefix,
        this.aiPrefix
      ),
    };
    return result;
  }

  /**
   * Saves the context from this conversation to buffer. If the amount
   * of tokens required to save the buffer exceeds MAX_TOKEN_LIMIT,
   * prune it.
   */
  async saveContext(inputValues: InputValues, outputValues: OutputValues) {
    await super.saveContext(inputValues, outputValues);

    // Prune buffer if it exceeds the max token limit set for this instance.
    const buffer = await this.chatHistory.getMessages();
    let currBufferLength = await this.llm.getNumTokens(
      getBufferString(buffer, this.humanPrefix, this.aiPrefix)
    );

    if (currBufferLength > this.maxTokenLimit) {
      const prunedMemory = [];
      while (currBufferLength > this.maxTokenLimit) {
        prunedMemory.push(buffer.shift());
        currBufferLength = await this.llm.getNumTokens(
          getBufferString(buffer, this.humanPrefix, this.aiPrefix)
        );
      }
    }
  }
}
