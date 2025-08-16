import { RecallioClient } from "recallio";
import type {
  ClientOptions as RecallioClientOptions,
  MemoryWithScoreDto,
  MemoryRecallOptions,
  SummarizedMemoriesDto,
} from "recallio";

import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getInputValue,
  getOutputValue,
} from "@langchain/core/memory";
import {
  BaseMessage,
  getBufferString,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

/**
 * Build a system prompt from RecallIO recall results and optional summary.
 */
export const recallioMemoryContextToSystemPrompt = (
  memories: MemoryWithScoreDto[] | null | undefined,
  summary?: SummarizedMemoriesDto | null
): string => {
  const parts: string[] = [];
  if (summary?.content) parts.push(String(summary.content));
  if (Array.isArray(memories) && memories.length > 0) {
    const content = memories
      .map((m) => m?.content)
      .filter((c): c is string => Boolean(c))
      .join("\n");
    if (content) parts.push(content);
  }
  return parts.join("\n");
};

/**
 * Condense RecallIO memory context into a single HumanMessage.
 */
export const condenseRecallioMemoryIntoHumanMessage = (
  memories: MemoryWithScoreDto[] | null | undefined,
  summary?: SummarizedMemoriesDto | null
): HumanMessage => {
  const basePrompt =
    "These are the memories I have stored. Give more weight to the user's current question. Adjust your answer based on the memories if relevant; otherwise, you may ignore them. Do not explicitly reference this memory section in your reply. The USER MEMORIES are:\n\n";
  const systemPrompt = recallioMemoryContextToSystemPrompt(memories, summary);
  return new HumanMessage(`${basePrompt}\n${systemPrompt}`);
};

/**
 * Convert RecallIO memory context to a list of BaseMessages.
 * Currently bundles all memory content into a single SystemMessage.
 */
export const recallioMemoryToMessages = (
  memories: MemoryWithScoreDto[] | null | undefined,
  summary?: SummarizedMemoriesDto | null
): BaseMessage[] => {
  const systemPrompt = recallioMemoryContextToSystemPrompt(memories, summary);
  return systemPrompt ? [new SystemMessage(systemPrompt)] : [];
};

export interface RecallioMemoryInput extends BaseChatMemoryInput {
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
  sessionId: string; // maps to userId in RecallIO
  apiKey: string;
  projectId: string;
  scope?: string; // Recall scope; e.g. "personal". Default: "personal"
  tags?: string[];
  recallOptions?: MemoryRecallOptions;
  consentFlag?: boolean; // Must be provided to store a memory. Default: true
  separateMessages?: boolean; // same semantics as other memories
  clientOptions?: Omit<RecallioClientOptions, "apiKey">; // e.g., baseUrl override
}

/**
 * Production-ready memory wrapper for RecallIO.
 */
export class RecallioMemory
  extends BaseChatMemory
  implements RecallioMemoryInput
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  apiKey: string;

  projectId: string;

  sessionId: string;

  scope: string;
  
  tags: string[] | undefined;

  recallOptions: MemoryRecallOptions | undefined;

  consentFlag: boolean;

  separateMessages: boolean;

  client: RecallioClient;

  constructor(fields: RecallioMemoryInput) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });

    if (!fields.apiKey)
      throw new Error("apiKey is required for RecallioMemory");
    if (!fields.sessionId)
      throw new Error("sessionId is required for RecallioMemory");
    if (!fields.projectId)
      throw new Error("projectId is required for RecallioMemory");

    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields.memoryKey ?? this.memoryKey;

    this.apiKey = fields.apiKey;
    this.projectId = fields.projectId;
    this.sessionId = fields.sessionId;

    this.scope = fields.scope ?? "user";
    this.tags = fields.tags;
    this.recallOptions = fields.recallOptions;
    this.consentFlag = fields.consentFlag ?? true;
    this.separateMessages = fields.separateMessages ?? false;

    const clientOpts: RecallioClientOptions = {
      apiKey: this.apiKey,
      ...(fields.clientOptions ?? {}),
    };
    this.client = new RecallioClient(clientOpts);
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    const hasQuery = Boolean(values.input);
    let memories: MemoryWithScoreDto[] | null = null;
    let summary: SummarizedMemoriesDto | null = null;

    try {
      if (hasQuery) {
        memories = await this.client.recallMemory(
          {
            userId: this.sessionId,
            projectId: this.projectId,
            query: String(values.input ?? "*"),
            scope: this.scope,
            tags: this.tags,
          },
          this.recallOptions
        );
      } else {
        // When there is no query, return a summary of facts if available
        summary = await this.client.recallSummary({
          userId: this.sessionId,
          projectId: this.projectId,
          scope: this.scope,
          tags: this.tags,
        });
      }
    } catch (error) {
      console.error("RecallIO: failed to load memories:", error);
      return this.returnMessages
        ? { [this.memoryKey]: [] }
        : { [this.memoryKey]: "" };
    }

    if (this.returnMessages) {
      return {
        [this.memoryKey]: this.separateMessages
          ? recallioMemoryToMessages(memories, summary)
          : [condenseRecallioMemoryIntoHumanMessage(memories, summary)],
      };
    }

    return {
      [this.memoryKey]: this.separateMessages
        ? getBufferString(
            recallioMemoryToMessages(memories, summary),
            this.humanPrefix,
            this.aiPrefix
          )
        : condenseRecallioMemoryIntoHumanMessage(memories, summary).content ??
          "",
    };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = getInputValue(inputValues, this.inputKey);
    const output = getOutputValue(outputValues, this.outputKey);

    if (!input || !output) {
      console.warn("RecallIO: missing input or output; skipping memory write");
      return;
    }

    const content = `${this.humanPrefix}: ${String(input)}\n${
      this.aiPrefix
    }: ${String(output)}`;

    try {
      await this.client.writeMemory({
        userId: this.sessionId,
        projectId: this.projectId,
        content,
        tags: this.tags,
        consentFlag: this.consentFlag,
      });
    } catch (error) {
      console.error("RecallIO: failed to write memory:", error);
      // Do not throw; continue chain execution
    }

    await super.saveContext(inputValues, outputValues);
  }

  async clear(): Promise<void> {
    try {
      await this.client.deleteMemory({
        scope: this.scope,
        userId: this.sessionId,
        projectId: this.projectId,
      });
    } catch (error) {
      console.error("RecallIO: failed to clear memories:", error);
    }

    await super.clear();
  }
}
