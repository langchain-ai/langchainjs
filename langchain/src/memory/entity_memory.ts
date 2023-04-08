import { BaseLanguageModel } from "base_language/index.js";
import { LLMChain, PromptTemplate } from "index.js";
import { BaseChatMessage } from "../schema/index.js";

import {
  BaseChatMemory,
  BaseMemoryInput,
  ChatMessageHistory,
} from "./chat_memory.js";
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

interface BaseEntityStore {
  get(key: string, defaultValue?: string): string | undefined;
  set(key: string, value?: string): void;
  delete(key: string): void;
  exists(key: string): boolean;
  clear(): void;
}

class InMemoryEntityStore implements BaseEntityStore {
  private store: Record<string, string | undefined> = {};

  public get(
    key: string,
    defaultValue: string | undefined
  ): string | undefined {
    return key in this.store ? this.store[key] : defaultValue;
  }

  public set(key: string, value: string | undefined): void {
    this.store[key] = value;
  }

  public delete(key: string): void {
    delete this.store[key];
  }

  public exists(key: string): boolean {
    return key in this.store;
  }

  public clear(): void {
    this.store = {};
  }
}

export interface EntityMemoryInput extends BaseMemoryInput {
  humanPrefix: string;
  aiPrefix: string;
  llm: BaseLanguageModel;
  entityExtractionPrompt: PromptTemplate;
  entitySummarizationPrompt: PromptTemplate;
  entityCache: string[];
  k: number;
  chatHistoryKey: string;
  entityStore: InMemoryEntityStore;
}

// Entity extractor & summarizer to memory.
export class EntityMemory extends BaseChatMemory implements EntityMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  entityExtractionPrompt = ENTITY_EXTRACTION_PROMPT;

  entitySummarizationPrompt = ENTITY_SUMMARIZATION_PROMPT;

  entityStore = new InMemoryEntityStore();

  entityCache: string[];

  k = 3;

  chatHistoryKey = "history";

  llm: BaseLanguageModel;

  entitiesKey = "entities";

  constructor(fields?: Partial<EntityMemoryInput>) {
    super({
      chatHistory: fields?.chatHistory,
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.chatHistoryKey = fields?.chatHistoryKey ?? this.chatHistoryKey;
    this.llm = fields?.llm ?? this.llm;
    this.entityExtractionPrompt =
      fields?.entityExtractionPrompt ?? this.entityExtractionPrompt;
    this.entityExtractionPrompt =
      fields?.entitySummarizationPrompt ?? this.entitySummarizationPrompt;
    this.entityStore =
      fields?.entityStore ?? (this.entityStore as InMemoryEntityStore);
    this.entityCache = fields?.entityCache ?? this.entityCache;
    this.k = fields?.k ?? this.k;
  }

  get buffer(): BaseChatMessage[] {
    return this.chatHistory.messages;
  }

  // Will always return list of memory variables.
  get memoryVariables(): string[] {
    return [this.entitiesKey, this.chatHistoryKey];
  }

  // Return history buffer.
  async loadMemoryVariables(inputs: InputValues): Promise<MemoryVariables> {
    const chain = new LLMChain({
      llm: this.llm,
      prompt: this.entityExtractionPrompt,
    });
    const promptInputKey =
      this.inputKey ?? getPromptInputKey(inputs, this.memoryVariables);
    const bufferString = getBufferString(
      this.buffer.slice(-this.k * 2),
      this.humanPrefix,
      this.aiPrefix
    );
    const output = await chain.predict({
      history: bufferString,
      input: inputs[promptInputKey],
    });
    const entities: string[] =
      output.trim() === "NONE" ? [] : output.split(",").map((w) => w.trim());
    const entitySummaries: { [key: string]: string | undefined } = {};

    for (const entity of entities) {
      entitySummaries[entity] = await this.entityStore.get(entity, "");
    }
    this.entityCache = [...entities];
    const buffer = this.returnMessages
      ? this.buffer.slice(-this.k * 2)
      : bufferString;

    return {
      [this.chatHistoryKey]: buffer,
      [this.entitiesKey]: entitySummaries,
    };
  }

  // Save context from this conversation to buffer.
  async saveContext(inputs: InputValues, outputs: OutputValues): Promise<void> {
    await super.saveContext(inputs, outputs);

    const promptInputKey =
      this.inputKey ?? getPromptInputKey(inputs, this.memoryVariables);
    const bufferString = getBufferString(
      this.buffer.slice(-this.k * 2),
      this.humanPrefix,
      this.aiPrefix
    );
    const inputData = inputs[promptInputKey];
    const chain = new LLMChain({
      llm: this.llm,
      prompt: this.entitySummarizationPrompt,
    });

    for (const entity of this.entityCache) {
      const existingSummary = this.entityStore.get(entity, "");
      const output = await chain.predict({
        summary: existingSummary,
        entity,
        history: bufferString,
        input: inputData,
      });
      this.entityStore.set(entity, output.trim());
    }
  }

  // Clear memory contents.
  clear(): void {
    this.chatHistory = new ChatMessageHistory();
    this.entityStore = new InMemoryEntityStore();
  }
}
