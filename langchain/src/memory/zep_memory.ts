import {
  ZepClient,
  SearchResult,
  SearchPayload,
  Memory,
  Message,
  MessageData,
  NotFoundError,
} from "@getzep/zep-js";

import {
  BaseChatMessageHistory,
  BaseChatMessage,
  AIChatMessage,
  HumanChatMessage,
} from "../schema/index.js";

import { InputValues, MemoryVariables, getBufferString } from "./base.js";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

/**
 * A ChatMemoryHistory implementation that uses Zep as backend Memory store for conversations. 
 * Recommended Usage::
 *  Setup a Zep Chat History
 *  const zepChatHistory = new ZepChatMessageHistory(sessionID, ZEP_API_URL); 
 * 
 *  Use a standard ConversationBufferMemory to encapsulate the Zep chat history 
 *  const memory = new ConversationBufferMemory("chat_history", zepChatHistory);
 * 
 *  Zep provides long-term conversation storage for LLM apps. The server stores,
 *  summarizes, embeds, indexes, and enriches conversational AI chat
 *  histories, and exposes them via simple, low-latency APIs.
 * 
 *  For server installation instructions and more, see: https://getzep.github.io/
 *  This class is a thin wrapper around the zep-python package. Additional
 *  Zep functionality is exposed via the zepSummary and zepMessages properties.
 * 
 *  For more information on the zep-python package, see:
 *  https://github.com/getzep/zep-js
 * 
 */
export class ZepChatMessageHistory extends BaseChatMessageHistory {
  private zepClient: ZepClient;

  private sessionID: string;

  constructor(sessionID: string, url: string = "http://localhost:8000") {
    super();
    this.zepClient = new ZepClient(url);
    this.sessionID = sessionID;
  }

  /**
  *  Adds an AI chat message to the Zep memory.
  *  @param {string} message - The content of the AI chat message.
  *  @returns {Promise<void>} A promise that resolves when the message is added to the Zep memory.
  */
  async addAIChatMessage(message: string): Promise<void> {
    const zepMessage: Message = {
      content: message,
      role: "ai",
      toDict(): MessageData {
        return {
          content: this.content,
          role: this.role,
        };
      },
    };

    const zepMemory: Memory = {
      messages: [zepMessage],
      metadata: {}, // Add an empty metadata object
      toDict(): any {
        return {
          messages: this.messages.map((msg) => msg.toDict()),
          metadata: this.metadata,
        };
      },
    };

    await this.zepClient.addMemory(this.sessionID, zepMemory);
  }

  /**
  *  Adds a user message to the Zep memory.
  *  @param {string} message - The content of the user message.
  *  @returns {Promise<void>} A promise that resolves when the message is added to the Zep memory.
  */
  async addUserMessage(message: string): Promise<void> {
    const zepMessage: Message = {
      content: message,
      role: "human",
      toDict(): MessageData {
        return {
          content: this.content,
          role: this.role,
        };
      },
    };

    const zepMemory: Memory = {
      messages: [zepMessage],
      metadata: {}, // Add an empty metadata object
      toDict(): any {
        return {
          messages: this.messages.map((msg) => msg.toDict()),
          metadata: this.metadata,
        };
      },
    };

    await this.zepClient.addMemory(this.sessionID, zepMemory);
  }

  /**
   *  Retrieves the chat messages from Zep memory.
   *  @returns {Promise<BaseChatMessage[]>} A promise that resolves to an array of chat messages.
  */
  async getMessages(): Promise<BaseChatMessage[]> {
    let zepMemory: Memory | null = null;

    try {
      zepMemory = await this._getMemory();
    } catch (error) {
      return [];
    }

    const messages: BaseChatMessage[] = [];

    if (zepMemory && zepMemory.summary && zepMemory.summary.content) {
      messages.push(new HumanChatMessage(zepMemory.summary.content));
    }

    if (zepMemory && zepMemory.messages) {
      for (const message of zepMemory.messages) {
        if (message.role === "ai") {
          messages.push(new AIChatMessage(message.content));
        } else {
          messages.push(new HumanChatMessage(message.content));
        }
      }
    }

    return messages;
  }

  /**
  *  Searches the Zep memory for chat messages matching the specified query.
  *  @param {string} query - The search query.
  *  @param {number} [limit] - The maximum number of search results to return.
  *  @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results.
  */
  async search(query: string, limit?: number): Promise<SearchResult[]> {
    const payload: SearchPayload = {
      text: query,
      meta: {},
    };

    return this.zepClient.searchMemory(this.sessionID, payload, limit);
  }

  /**
  *  Clears the Zep memory for the current session.
  *  @returns {Promise<void>} A promise that resolves once the memory is cleared.
  *  @throws {NotFoundError} If the session is not found in Zep.
  */
  async clear(): Promise<void> {
    try {
      await this.zepClient.deleteMemory(this.sessionID);
    } catch (error) {
      throw new NotFoundError(`Session ${this.sessionID} not found in Zep.`);
    }
  }

  /**
  *  Retrieves the Zep memory for the current session.
  *  @returns {Promise<Memory>} A promise that resolves with the Zep memory.
  *  @throws {NotFoundError} If the session is not found in Zep.
  */
  private async _getMemory(): Promise<Memory> {
    const zepMemory: Memory | null = await this.zepClient.getMemory(
      this.sessionID
    );

    if (!zepMemory) {
      throw new NotFoundError(`Session ${this.sessionID} not found in Zep.`);
    }

    return zepMemory;
  }
}

export interface ZepMemoryInput extends BaseChatMemoryInput {
  humanPrefix?: string;

  aiPrefix?: string;

  memoryKey?: string;

  baseURL?: string;

  sessionID?: string;

}

export class ZepMemory extends BaseChatMemory implements ZepMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  baseURL?: string; // Define the baseURL property

  sessionID?: string; // Define the sessionID property

  constructor(fields?: ZepMemoryInput) {
    super({
      chatHistory: fields?.chatHistory,
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });

    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
    this.baseURL = fields?.baseURL ?? this.baseURL;
    this.sessionID = fields?.sessionID ?? this.sessionID;
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

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
}
