import { BaseLanguageModel } from "../base_language/index.js";
import { BaseEntityStore } from "../schema/index.js";

import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";
import {
  ENTITY_EXTRACTION_PROMPT,
  ENTITY_SUMMARIZATION_PROMPT,
} from "./prompt.js";
import {
  InputValues,
  MemoryVariables,
  OutputValues,
  getBufferString,
  getPromptInputKey,
} from "./base.js";
import { LLMChain } from "../chains/llm_chain.js";
import { PromptTemplate } from "../prompts/prompt.js";
import { InMemoryEntityStore } from "./stores/entity/in_memory.js";

/**
 * Interface for the input parameters required by the EntityMemory class.
 */
export interface EntityMemoryInput extends BaseChatMemoryInput {
  llm: BaseLanguageModel;
  humanPrefix?: string;
  aiPrefix?: string;
  entityExtractionPrompt?: PromptTemplate;
  entitySummarizationPrompt?: PromptTemplate;
  entityCache?: string[];
  k?: number;
  chatHistoryKey?: string;
  entitiesKey?: string;
  entityStore?: BaseEntityStore;
}

// Entity extractor & summarizer to memory.
/**
 * Class for managing entity extraction and summarization to memory in
 * chatbot applications. Extends the BaseChatMemory class and implements
 * the EntityMemoryInput interface.
 * @example
 * ```typescript
 * const memory = new EntityMemory({
 *   llm: new ChatOpenAI({ temperature: 0 }),
 *   chatHistoryKey: "history",
 *   entitiesKey: "entities",
 * });
 * const model = new ChatOpenAI({ temperature: 0.9 });
 * const chain = new LLMChain({
 *   llm: model,
 *   prompt: ENTITY_MEMORY_CONVERSATION_TEMPLATE,
 *   memory,
 * });
 *
 * const res1 = await chain.call({ input: "Hi! I'm Jim." });
 * console.log({
 *   res1,
 *   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
 * });
 *
 * const res2 = await chain.call({
 *   input: "I work in construction. What about you?",
 * });
 * console.log({
 *   res2,
 *   memory: await memory.loadMemoryVariables({ input: "Who is Jim?" }),
 * });
 *
 * ```
 */
export class EntityMemory extends BaseChatMemory implements EntityMemoryInput {
  private entityExtractionChain: LLMChain;

  private entitySummarizationChain: LLMChain;

  entityStore: BaseEntityStore;

  entityCache: string[] = [];

  k = 3;

  chatHistoryKey = "history";

  llm: BaseLanguageModel;

  entitiesKey = "entities";

  humanPrefix?: string;

  aiPrefix?: string;

  constructor(fields: EntityMemoryInput) {
    super({
      chatHistory: fields.chatHistory,
      returnMessages: fields.returnMessages ?? false,
      inputKey: fields.inputKey,
      outputKey: fields.outputKey,
    });
    this.llm = fields.llm;
    this.humanPrefix = fields.humanPrefix;
    this.aiPrefix = fields.aiPrefix;
    this.chatHistoryKey = fields.chatHistoryKey ?? this.chatHistoryKey;
    this.entitiesKey = fields.entitiesKey ?? this.entitiesKey;
    this.entityExtractionChain = new LLMChain({
      llm: this.llm,
      prompt: fields.entityExtractionPrompt ?? ENTITY_EXTRACTION_PROMPT,
    });
    this.entitySummarizationChain = new LLMChain({
      llm: this.llm,
      prompt: fields.entitySummarizationPrompt ?? ENTITY_SUMMARIZATION_PROMPT,
    });
    this.entityStore = fields.entityStore ?? new InMemoryEntityStore();
    this.entityCache = fields.entityCache ?? this.entityCache;
    this.k = fields.k ?? this.k;
  }

  get memoryKeys() {
    return [this.chatHistoryKey];
  }

  // Will always return list of memory variables.
  get memoryVariables(): string[] {
    return [this.entitiesKey, this.chatHistoryKey];
  }

  // Return history buffer.
  /**
   * Method to load memory variables and perform entity extraction.
   * @param inputs Input values for the method.
   * @returns Promise resolving to an object containing memory variables.
   */
  async loadMemoryVariables(inputs: InputValues): Promise<MemoryVariables> {
    const promptInputKey =
      this.inputKey ?? getPromptInputKey(inputs, this.memoryVariables);
    const messages = await this.chatHistory.getMessages();
    const serializedMessages = getBufferString(
      messages.slice(-this.k * 2),
      this.humanPrefix,
      this.aiPrefix
    );
    const output = await this.entityExtractionChain.predict({
      history: serializedMessages,
      input: inputs[promptInputKey],
    });
    const entities: string[] =
      output.trim() === "NONE" ? [] : output.split(",").map((w) => w.trim());
    const entitySummaries: { [key: string]: string | undefined } = {};

    for (const entity of entities) {
      entitySummaries[entity] = await this.entityStore.get(
        entity,
        "No current information known."
      );
    }
    this.entityCache = [...entities];
    const buffer = this.returnMessages
      ? messages.slice(-this.k * 2)
      : serializedMessages;

    return {
      [this.chatHistoryKey]: buffer,
      [this.entitiesKey]: entitySummaries,
    };
  }

  // Save context from this conversation to buffer.
  /**
   * Method to save the context from a conversation to a buffer and perform
   * entity summarization.
   * @param inputs Input values for the method.
   * @param outputs Output values from the method.
   * @returns Promise resolving to void.
   */
  async saveContext(inputs: InputValues, outputs: OutputValues): Promise<void> {
    await super.saveContext(inputs, outputs);

    const promptInputKey =
      this.inputKey ?? getPromptInputKey(inputs, this.memoryVariables);
    const messages = await this.chatHistory.getMessages();
    const serializedMessages = getBufferString(
      messages.slice(-this.k * 2),
      this.humanPrefix,
      this.aiPrefix
    );
    const inputData = inputs[promptInputKey];

    for (const entity of this.entityCache) {
      const existingSummary = await this.entityStore.get(
        entity,
        "No current information known."
      );
      const output = await this.entitySummarizationChain.predict({
        summary: existingSummary,
        entity,
        history: serializedMessages,
        input: inputData,
      });
      if (output.trim() !== "UNCHANGED") {
        await this.entityStore.set(entity, output.trim());
      }
    }
  }

  // Clear memory contents.
  /**
   * Method to clear the memory contents.
   * @returns Promise resolving to void.
   */
  async clear() {
    await super.clear();
    await this.entityStore.clear();
  }
}
