import {
  Memory as BaseMemory,
  Message,
  NotFoundError,
  ZepClient,
} from "@getzep/zep-js";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getInputValue,
  getOutputValue,
} from "@langchain/core/memory";
import {
  getBufferString,
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

// Simple type for processed Zep memory data
interface ZepMemoryData {
  messages: Array<{
    role: string;
    content: string;
  }>;
  summary?: {
    content?: string;
  };
}

/**
 * Extracts summary from Zep memory and composes a system prompt.
 * @param memory - The memory object containing potential summary.
 * @returns A string containing the summary as a system prompt.
 */
export const zepMemoryContextToSystemPrompt = (memory: ZepMemoryData) => {
  let systemPrompt = "";

  // Extract summary, if present
  if (memory.summary && memory.summary?.content) {
    systemPrompt += memory.summary.content;
  }

  return systemPrompt;
};

/**
 * Condenses Zep memory context into a single HumanMessage.
 * This is particularly useful for models like Claude that have limitations with system messages
 * (e.g., Anthropic's Claude only supports one system message and doesn't support multiple user messages in a row).
 *
 * @param memory - The memory object containing conversation history.
 * @param humanPrefix - The prefix to use for human messages (default: "Human").
 * @param aiPrefix - The prefix to use for AI messages (default: "AI").
 * @returns A HumanMessage containing the condensed memory context.
 */
export const condenseZepMemoryIntoHumanMessage = (memory: ZepMemoryData) => {
  const systemPrompt = zepMemoryContextToSystemPrompt(memory);

  let concatMessages = "";

  // Add message history to the prompt, if present
  if (memory.messages) {
    concatMessages = memory.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
  }

  return new HumanMessage(
    `${systemPrompt ? systemPrompt + "\n" : ""}${concatMessages}`
  );
};

/**
 * Converts Zep Memory to a list of BaseMessages, preserving the structure.
 * Creates a SystemMessage from summary and facts, and converts the rest of the messages
 * to their corresponding message types.
 *
 * @param memory - The memory object containing conversation history.
 * @param humanPrefix - The prefix to use for human messages (default: "Human").
 * @param aiPrefix - The prefix to use for AI messages (default: "AI").
 * @returns An array of BaseMessage objects representing the conversation history.
 */
export const zepMemoryToMessages = (
  memory: ZepMemoryData,
  humanPrefix = "Human",
  aiPrefix = "AI"
) => {
  const systemPrompt = zepMemoryContextToSystemPrompt(memory);

  let messages: BaseMessage[] = systemPrompt
    ? [new SystemMessage(systemPrompt)]
    : [];

  if (memory && memory.messages) {
    messages = messages.concat(
      memory.messages
        .filter((m) => m.content)
        .map((message) => {
          const { content, role } = message;
          if (role === humanPrefix) {
            return new HumanMessage(content);
          } else if (role === aiPrefix) {
            return new AIMessage(content);
          } else {
            // default to generic ChatMessage
            return new ChatMessage(content, role);
          }
        })
    );
  }

  return messages;
};

/**
 * Interface defining the structure of the input data for the ZepMemory
 * class. It includes properties like humanPrefix, aiPrefix, memoryKey,
 * baseURL, sessionId, apiKey, and separateMessages.
 */
export interface ZepMemoryInput extends BaseChatMemoryInput {
  humanPrefix?: string;

  aiPrefix?: string;

  memoryKey?: string;

  baseURL: string;

  sessionId: string;

  // apiKey is optional.
  apiKey?: string;

  /**
   * Whether to return separate messages for chat history with a SystemMessage containing facts and summary,
   * or return a single HumanMessage with the entire memory context.
   * Defaults to true (preserving message types) for backward compatibility.
   *
   * Keep as true for models that fully support system messages.
   * Set to false for models like Claude that have limitations with system messages.
   */
  separateMessages?: boolean;
}

/**
 * Class used to manage the memory of a chat session, including loading
 * and saving the chat history, and clearing the memory when needed. It
 * uses the ZepClient to interact with the Zep service for managing the
 * chat session's memory.
 *
 * The class provides options for handling different LLM requirements:
 * - Use separateMessages=true (default) for models that fully support system messages
 * - Use separateMessages=false for models like Claude that have limitations with system messages
 *
 * @example
 * ```typescript
 * const sessionId = randomUUID();
 * const zepURL = "http://your-zep-url";
 *
 * // Initialize ZepMemory with session ID, base URL, and API key
 * const memory = new ZepMemory({
 *   sessionId,
 *   baseURL: zepURL,
 *   apiKey: "change_this_key",
 *   // Set to false for models like Claude that have limitations with system messages
 *   // Defaults to true for backward compatibility
 *   separateMessages: false,
 * });
 *
 * // Create a ChatOpenAI model instance with specific parameters
 * const model = new ChatOpenAI({
 *   model: "gpt-3.5-turbo",
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
export class ZepMemory extends BaseChatMemory implements ZepMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  baseURL: string;

  sessionId: string;

  zepClientPromise: Promise<ZepClient>;

  private readonly zepInitFailMsg = "ZepClient is not initialized";

  /**
   * Whether to return separate messages for chat history with a SystemMessage containing facts and summary,
   * or return a single HumanMessage with the entire memory context.
   * Defaults to true (preserving message types) for backward compatibility.
   *
   * Keep as true for models that fully support system messages.
   * Set to false for models like Claude that have limitations with system messages.
   */
  separateMessages: boolean;

  constructor(fields: ZepMemoryInput) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });

    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields.memoryKey ?? this.memoryKey;
    this.baseURL = fields.baseURL;
    this.sessionId = fields.sessionId;
    this.separateMessages = fields.separateMessages ?? true;
    this.zepClientPromise = ZepClient.init(this.baseURL, fields.apiKey);
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

    // Wait for ZepClient to be initialized
    const zepClient = await this.zepClientPromise;
    if (!zepClient) {
      throw new Error(this.zepInitFailMsg);
    }

    const lastN = values.lastN ?? undefined;

    let memory: BaseMemory | null = null;
    try {
      memory = await zepClient.memory.getMemory(this.sessionId, lastN);
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof NotFoundError) {
        const result = this.returnMessages
          ? { [this.memoryKey]: [] }
          : { [this.memoryKey]: "" };
        return result;
      } else {
        throw error;
      }
    }

    // Convert BaseMemory to ZepMemoryData
    const memoryData: ZepMemoryData = {
      messages:
        memory?.messages.map((msg: Message) => ({
          role: msg.role,
          content: msg.content,
        })) || [],
      summary: memory?.summary,
    };

    if (this.returnMessages) {
      return {
        [this.memoryKey]: this.separateMessages
          ? zepMemoryToMessages(memoryData, this.humanPrefix, this.aiPrefix)
          : [condenseZepMemoryIntoHumanMessage(memoryData)],
      };
    }
    return {
      [this.memoryKey]: this.separateMessages
        ? getBufferString(
            zepMemoryToMessages(memoryData, this.humanPrefix, this.aiPrefix),
            this.humanPrefix,
            this.aiPrefix
          )
        : condenseZepMemoryIntoHumanMessage(memoryData).content,
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

    // Create new Memory and Message instances
    const memory = new BaseMemory({
      messages: [
        new Message({
          role: this.humanPrefix,
          content: `${input}`,
        }),
        new Message({
          role: this.aiPrefix,
          content: `${output}`,
        }),
      ],
    });

    // Wait for ZepClient to be initialized
    const zepClient = await this.zepClientPromise;
    if (!zepClient) {
      throw new Error(this.zepInitFailMsg);
    }

    // Add the new memory to the session using the ZepClient
    if (this.sessionId) {
      try {
        await zepClient.memory.addMemory(this.sessionId, memory);
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
    // Wait for ZepClient to be initialized
    const zepClient = await this.zepClientPromise;
    if (!zepClient) {
      throw new Error(this.zepInitFailMsg);
    }

    try {
      await zepClient.memory.deleteMemory(this.sessionId);
    } catch (error) {
      console.error("Error deleting session: ", error);
    }

    // Clear the superclass's chat history
    await super.clear();
  }
}
