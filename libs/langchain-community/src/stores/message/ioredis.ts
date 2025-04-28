import { Redis, RedisOptions } from "ioredis";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

/**
 * Type for the input parameter of the RedisChatMessageHistory
 * constructor. It includes fields for the session ID, session TTL, Redis
 * URL, Redis configuration, and Redis client.
 */
export type RedisChatMessageHistoryInput = {
  sessionId: string;
  sessionTTL?: number;
  url?: string;
  config?: RedisOptions;
  client?: Redis;
};

/**
 * Class used to store chat message history in Redis. It provides methods
 * to add, retrieve, and clear messages from the chat history.
 * @example
 * ```typescript
 * const chatHistory = new RedisChatMessageHistory({
 *   sessionId: new Date().toISOString(),
 *   sessionTTL: 300,
 *   url: "redis:
 * });
 *
 * const chain = new ConversationChain({
 *   llm: new ChatOpenAI({ temperature: 0 }),
 *   memory: { chatHistory },
 * });
 *
 * const response = await chain.invoke({
 *   input: "What did I just say my name was?",
 * });
 * console.log({ response });
 * ```
 */
export class RedisChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "ioredis"];

  get lc_secrets() {
    return {
      url: "REDIS_URL",
      "config.username": "REDIS_USERNAME",
      "config.password": "REDIS_PASSWORD",
    };
  }

  public client: Redis;

  private sessionId: string;

  private sessionTTL?: number;

  constructor(fields: RedisChatMessageHistoryInput) {
    super(fields);

    const { sessionId, sessionTTL, url, config, client } = fields;
    this.client = (client ??
      (url ? new Redis(url) : new Redis(config ?? {}))) as Redis;
    this.sessionId = sessionId;
    this.sessionTTL = sessionTTL;
  }

  /**
   * Retrieves all messages from the chat history.
   * @returns Promise that resolves with an array of BaseMessage instances.
   */
  async getMessages(): Promise<BaseMessage[]> {
    const rawStoredMessages = await this.client.lrange(this.sessionId, 0, -1);
    const orderedMessages = rawStoredMessages
      .reverse()
      .map((message) => JSON.parse(message));
    return mapStoredMessagesToChatMessages(orderedMessages);
  }

  /**
   * Adds a message to the chat history.
   * @param message The message to add to the chat history.
   * @returns Promise that resolves when the message has been added.
   */
  async addMessage(message: BaseMessage): Promise<void> {
    const messageToAdd = mapChatMessagesToStoredMessages([message]);
    await this.client.lpush(this.sessionId, JSON.stringify(messageToAdd[0]));
    if (this.sessionTTL) {
      await this.client.expire(this.sessionId, this.sessionTTL);
    }
  }

  /**
   * Clears all messages from the chat history.
   * @returns Promise that resolves when the chat history has been cleared.
   */
  async clear(): Promise<void> {
    await this.client.del(this.sessionId);
  }
}
