import { MemoryClient } from "mem0ai";
import type { Memory, MemoryOptions, SearchOptions } from "mem0ai";

import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getInputValue,
  getOutputValue,
} from "@langchain/core/memory";
import { HumanMessage } from "@langchain/core/messages";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

/**
 * Extracts and formats memory content into a system prompt
 * @param memory Array of Memory objects from mem0ai
 * @returns Formatted system prompt string
 */
export const mem0MemoryContextToSystemPrompt = (memory: Memory[]): string => {
  if (!memory || !Array.isArray(memory)) {
    return "";
  }

  return memory
    .filter((m) => m?.memory)
    .map((m) => m.memory)
    .join("\n");
};

/**
 * Condenses memory content into a single HumanMessage with context
 * @param memory Array of Memory objects from mem0ai
 * @returns HumanMessage containing formatted memory context
 */
export const condenseMem0MemoryIntoHumanMessage = (memory: Memory[]): HumanMessage => {
  const basePrompt =
    "These are the memories I have stored. Give more weightage to the question by users and try to answer that first. You have to modify your answer based on the memories I have provided. If the memories are irrelevant you can ignore them. Also don't reply to this section of the prompt, or the memories, they are only for your reference. The MEMORIES of the USER are: \n\n";
  const systemPrompt = mem0MemoryContextToSystemPrompt(memory);

  return new HumanMessage(`${basePrompt}\n${systemPrompt}`);
};

/**
 * Interface defining the structure of the input data for the Mem0Client
 */
export interface ClientOptions {
  apiKey: string;
  host?: string;
  organizationName?: string;
  projectName?: string;
  organizationId?: string;
  projectId?: string;
}

/**
 * Interface defining the structure of the input data for the Mem0Memory
 * class. It includes properties like memoryKey, sessionId, and apiKey.
 */
export interface Mem0MemoryInput extends BaseChatMemoryInput {
  sessionId: string;
  apiKey: string;
  humanPrefix?: string;
  aiPrefix?: string;
  memoryOptions?: MemoryOptions | SearchOptions;
  mem0Options?: ClientOptions;
}

/**
 * Class used to manage the memory of a chat session using the Mem0 service.
 * It handles loading and saving chat history, and provides methods to format
 * the memory content for use in chat models.
 * 
 * @example
 * ```typescript
 * const memory = new Mem0Memory({
 *   sessionId: "user123" // or use user_id inside of memoryOptions (recommended),
 *   apiKey: "your-api-key",
 *   memoryOptions: {
 *     user_id: "user123",
 *     run_id: "run123"
 *   },
 * });
 * 
 * // Use with a chat model
 * const model = new ChatOpenAI({
 *   modelName: "gpt-3.5-turbo",
 *   temperature: 0,
 * });
 * 
 * const chain = new ConversationChain({ llm: model, memory });
 * ```
 */
export class Mem0Memory extends BaseChatMemory implements Mem0MemoryInput {
  memoryKey = "history";

  apiKey: string;

  sessionId: string;
  
  humanPrefix = "Human";
  
  aiPrefix = "AI";
  
  mem0Client: InstanceType<typeof MemoryClient>;
  
  memoryOptions: MemoryOptions | SearchOptions;

  mem0Options: ClientOptions;

  constructor(fields: Mem0MemoryInput) {
    if (!fields.apiKey) {
      throw new Error("apiKey is required for Mem0Memory");
    }
    if (!fields.sessionId) {
      throw new Error("sessionId is required for Mem0Memory");
    }

    super({
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });

    this.apiKey = fields.apiKey;
    this.sessionId = fields.sessionId;
    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.memoryOptions = fields.memoryOptions ?? {};
    this.mem0Options = fields.mem0Options ?? {
      apiKey: this.apiKey,
    };

    try {
      this.mem0Client = new MemoryClient({
        ...this.mem0Options,
        apiKey: this.apiKey,
      });
    } catch (error) {
      console.error("Failed to initialize Mem0Client:", error);
      throw new Error("Failed to initialize Mem0Client. Please check your configuration.");
    }
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  /**
   * Retrieves memories from the Mem0 service and formats them for use
   * @param values Input values containing optional search query
   * @returns Promise resolving to formatted memory variables
   */
  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    const searchType = values.input ? "search" : "get_all";
    let memories: Memory[] = [];

    try {
      if (searchType === "get_all") {
        memories = await this.mem0Client.getAll({
          user_id: this.sessionId,
          ...this.memoryOptions,
        });
      } else {
        memories = await this.mem0Client.search(values.input, {
          user_id: this.sessionId,
          ...this.memoryOptions,
        });
      }
    } catch (error) {
      console.error("Error loading memories:", error);
      return this.returnMessages
        ? { [this.memoryKey]: [] }
        : { [this.memoryKey]: "" };
    }

    if (this.returnMessages) {
      return {
        [this.memoryKey]: [condenseMem0MemoryIntoHumanMessage(memories)],
      };
    }

    return {
      [this.memoryKey]: condenseMem0MemoryIntoHumanMessage(memories).content ?? "",
    };
  }

  /**
   * Saves the current conversation context to the Mem0 service
   * @param inputValues Input messages to be saved
   * @param outputValues Output messages to be saved
   * @returns Promise resolving when the context has been saved
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = getInputValue(inputValues, this.inputKey);
    const output = getOutputValue(outputValues, this.outputKey);

    if (!input || !output) {
      console.warn("Missing input or output values, skipping memory save");
      return;
    }

    try {
      const messages = [
        {
          role: "user",
          content: `${input}`,
        },
        {
          role: "assistant",
          content: `${output}`,
        },
      ];

      await this.mem0Client.add(messages, {
        user_id: this.sessionId,
        ...this.memoryOptions,
      });
    } catch (error) {
      console.error("Error saving memory context:", error);
      // Continue execution even if memory save fails
    }

    await super.saveContext(inputValues, outputValues);
  }

  /**
   * Clears all memories for the current session
   * @returns Promise resolving when memories have been cleared
   */
  async clear(): Promise<void> {
    try {
      // Note: Implement clear functionality if Mem0Client provides it
      // await this.mem0Client.clear(this.sessionId);
    } catch (error) {
      console.error("Error clearing memories:", error);
    }

    await super.clear();
  }
}
