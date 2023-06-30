import { Memory, Message, NotFoundError, ZepClient } from "@getzep/zep-js";
import {
  getBufferString,
  getInputValue,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "./base.js";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";
import {
  AIChatMessage,
  BaseChatMessage,
  ChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "../schema/index.js";

export interface ZepMemoryInput extends BaseChatMemoryInput {
  humanPrefix?: string;

  aiPrefix?: string;

  memoryKey?: string;

  baseURL: string;

  sessionId: string;

  // apiKey is optional.
  apiKey?: string;
}

export class ZepMemory extends BaseChatMemory implements ZepMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  baseURL: string;

  sessionId: string;

  zepClient: ZepClient;

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
    this.zepClient = new ZepClient(this.baseURL, fields.apiKey);
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    // use either lastN provided by developer or undefined to use the
    // server preset.
    const lastN = values.lastN ?? undefined;

    let memory: Memory | null = null;
    try {
      memory = await this.zepClient.getMemory(this.sessionId, lastN);
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

    let messages: BaseChatMessage[] =
      memory && memory.summary?.content
        ? [new SystemChatMessage(memory.summary.content)]
        : [];

    if (memory) {
      messages = messages.concat(
        memory.messages.map((message) => {
          const { content, role } = message;
          if (role === this.humanPrefix) {
            return new HumanChatMessage(content);
          } else if (role === this.aiPrefix) {
            return new AIChatMessage(content);
          } else {
            // default to generic ChatMessage
            return new ChatMessage(content, role);
          }
        })
      );
    }

    if (this.returnMessages) {
      return {
        [this.memoryKey]: messages,
      };
    }
    return {
      [this.memoryKey]: getBufferString(
        messages,
        this.humanPrefix,
        this.aiPrefix
      ),
    };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = getInputValue(inputValues, this.inputKey);
    const output = getInputValue(outputValues, this.outputKey);

    // Create new Memory and Message instances
    const memory = new Memory({
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

    // Add the new memory to the session using the ZepClient
    if (this.sessionId) {
      try {
        await this.zepClient.addMemory(this.sessionId, memory);
      } catch (error) {
        console.error("Error adding memory: ", error);
      }
    }

    // Call the superclass's saveContext method
    await super.saveContext(inputValues, outputValues);
  }

  async clear(): Promise<void> {
    try {
      await this.zepClient.deleteMemory(this.sessionId);
    } catch (error) {
      console.error("Error deleting session: ", error);
    }

    // Clear the superclass's chat history
    await super.clear();
  }
}
