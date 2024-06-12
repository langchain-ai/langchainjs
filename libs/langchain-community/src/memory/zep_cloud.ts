import { Zep, ZepClient } from "@getzep/zep-cloud";
import { Memory, NotFoundError } from "@getzep/zep-cloud/api";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getInputValue,
  getOutputValue,
} from "@langchain/core/memory";
import { HumanMessage } from "@langchain/core/messages";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

// We are condensing the Zep context into a human message in order to satisfy
// some models' input requirements and allow more flexibility for devs.
// (for example, Anthropic only supports one system message, and does not support multiple user messages in a row)
export const condenseZepMemoryIntoHumanMessage = (memory: Memory) => {
  let systemPrompt = "";

  // Extract conversation facts, if present
  if (memory.facts) {
    systemPrompt += memory.facts.join("\n");
  }

  // Extract summary, if present
  if (memory.summary && memory.summary?.content) {
    systemPrompt += memory.summary.content;
  }

  let concatMessages = "";

  // Add message history to the prompt, if present
  if (memory.messages) {
    concatMessages = memory.messages
      .map((msg) => `${msg.role ?? msg.roleType}: ${msg.content}`)
      .join("\n");
  }

  return new HumanMessage(`${systemPrompt}\n${concatMessages}`);
};

/**
 * Interface defining the structure of the input data for the ZepMemory
 * class. It includes properties like humanPrefix, aiPrefix, memoryKey, memoryType
 * sessionId, and apiKey.
 */
export interface ZepCloudMemoryInput extends BaseChatMemoryInput {
  humanPrefix?: string;

  aiPrefix?: string;

  memoryKey?: string;

  sessionId: string;

  apiKey: string;

  memoryType?: Zep.MemoryGetRequestMemoryType;
}

/**
 * Class used to manage the memory of a chat session, including loading
 * and saving the chat history, and clearing the memory when needed. It
 * uses the ZepClient to interact with the Zep service for managing the
 * chat session's memory.
 * @example
 * ```typescript
 * const sessionId = randomUUID();
 *
 * // Initialize ZepCloudMemory with session ID and API key
 * const memory = new ZepCloudMemory({
 *   sessionId,
 *   apiKey: "<zep api key>",
 * });
 *
 * // Create a ChatOpenAI model instance with specific parameters
 * const model = new ChatOpenAI({
 *   modelName: "gpt-3.5-turbo",
 *   temperature: 0,
 * });
 *
 * // Create a ConversationChain with the model and memory
 * const chain = new ConversationChain({ llm: model, memory });
 *
 * // Example of calling the chain with an input
 * const res1 = await chain.call({ input: "Hi! I'm Jim." });
 * console.log({ res1 });
 *
 * // Follow-up call to the chain to demonstrate memory usage
 * const res2 = await chain.call({ input: "What did I just say my name was?" });
 * console.log({ res2 });
 *
 * // Output the session ID and the current state of memory
 * console.log("Session ID: ", sessionId);
 * console.log("Memory: ", await memory.loadMemoryVariables({}));
 *
 * ```
 */
export class ZepCloudMemory
  extends BaseChatMemory
  implements ZepCloudMemoryInput
{
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  apiKey: string;

  sessionId: string;

  zepClient: ZepClient;

  memoryType: Zep.MemoryGetRequestMemoryType;

  constructor(fields: ZepCloudMemoryInput) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });

    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields.memoryKey ?? this.memoryKey;
    this.apiKey = fields.apiKey;
    this.sessionId = fields.sessionId;
    this.memoryType = fields.memoryType ?? "perpetual";
    this.zepClient = new ZepClient({
      apiKey: this.apiKey,
    });
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  /**
   * Method that retrieves the chat history from the Zep service and formats
   * it into a list of messages.
   * @param values Input values for the method.
   * @returns Promise that resolves with the chat history formatted into a list of messages.
   */
  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    // use either lastN provided by developer or undefined to use the
    // server preset.

    const memoryType = values.memoryType ?? "perpetual";
    let memory: Memory | null = null;
    try {
      memory = await this.zepClient.memory.get(this.sessionId, {
        memoryType,
      });
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof NotFoundError) {
        return this.returnMessages
          ? { [this.memoryKey]: [] }
          : { [this.memoryKey]: "" };
      }
      throw error;
    }

    if (this.returnMessages) {
      return {
        [this.memoryKey]: [condenseZepMemoryIntoHumanMessage(memory)],
      };
    }
    return {
      [this.memoryKey]: condenseZepMemoryIntoHumanMessage(memory).content,
    };
  }

  /**
   * Method that saves the input and output messages to the Zep service.
   * @param inputValues Input messages to be saved.
   * @param outputValues Output messages to be saved.
   * @returns Promise that resolves when the messages have been saved.
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = getInputValue(inputValues, this.inputKey);
    const output = getOutputValue(outputValues, this.outputKey);

    // Add the new memory to the session using the ZepClient
    if (this.sessionId) {
      try {
        await this.zepClient.memory.add(this.sessionId, {
          messages: [
            {
              role: this.humanPrefix,
              roleType: "user",
              content: `${input}`,
            },
            {
              role: this.aiPrefix,
              roleType: "assistant",
              content: `${output}`,
            },
          ],
        });
      } catch (error) {
        console.error("Error adding memory: ", error);
      }
    }

    // Call the superclass's saveContext method
    await super.saveContext(inputValues, outputValues);
  }

  /**
   * Method that deletes the chat history from the Zep service.
   * @returns Promise that resolves when the chat history has been deleted.
   */
  async clear(): Promise<void> {
    try {
      await this.zepClient.memory.delete(this.sessionId);
    } catch (error) {
      console.error("Error deleting session: ", error);
    }

    // Clear the superclass's chat history
    await super.clear();
  }
}
