// TODO: Deprecate in favor of stores/message/ioredis.ts when LLMCache and other implementations are ported
import {
  createClient,
  RedisClientOptions,
  RedisClientType,
  RedisModules,
  RedisFunctions,
  RedisScripts,
} from "redis";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

/**
 * Type for the input to the `RedisChatMessageHistory` constructor.
 */
export type RedisChatMessageHistoryInput = {
  sessionId: string;
  sessionTTL?: number;
  config?: RedisClientOptions;
  // Typing issues with createClient output: https://github.com/redis/node-redis/issues/1865
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
};

/**
 * Class for storing chat message history using Redis. Extends the
 * `BaseListChatMessageHistory` class.
 * @example
 * ```typescript
 * const chatHistory = new RedisChatMessageHistory({
 *   sessionId: new Date().toISOString(),
 *   sessionTTL: 300,
 *   url: "redis:
 * });
 *
 * const chain = new ConversationChain({
 *   llm: new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
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
  lc_namespace = ["langchain", "stores", "message", "redis"];

  get lc_secrets() {
    return {
      "config.url": "REDIS_URL",
      "config.username": "REDIS_USERNAME",
      "config.password": "REDIS_PASSWORD",
    };
  }

  public client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

  private sessionId: string;

  private sessionTTL?: number;

  constructor(fields: RedisChatMessageHistoryInput) {
    super(fields);

    const { sessionId, sessionTTL, config, client } = fields;
    this.client = (client ?? createClient(config ?? {})) as RedisClientType<
      RedisModules,
      RedisFunctions,
      RedisScripts
    >;
    this.sessionId = sessionId;
    this.sessionTTL = sessionTTL;
  }

  /**
   * Ensures the Redis client is ready to perform operations. If the client
   * is not ready, it attempts to connect to the Redis database.
   * @returns Promise resolving to true when the client is ready.
   */
  async ensureReadiness() {
    if (!this.client.isReady) {
      await this.client.connect();
    }
    return true;
  }

  /**
   * Retrieves all chat messages from the Redis database for the current
   * session.
   * @returns Promise resolving to an array of `BaseMessage` instances.
   */
  async getMessages(): Promise<BaseMessage[]> {
    await this.ensureReadiness();
    const rawStoredMessages = await this.client.lRange(this.sessionId, 0, -1);
    const orderedMessages = rawStoredMessages
      .reverse()
      .map((message) => JSON.parse(message));
    return mapStoredMessagesToChatMessages(orderedMessages);
  }

  /**
   * Adds a new chat message to the Redis database for the current session.
   * @param message The `BaseMessage` instance to add.
   * @returns Promise resolving when the message has been added.
   */
  async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureReadiness();
    const messageToAdd = mapChatMessagesToStoredMessages([message]);
    await this.client.lPush(this.sessionId, JSON.stringify(messageToAdd[0]));
    if (this.sessionTTL) {
      await this.client.expire(this.sessionId, this.sessionTTL);
    }
  }

  /**
   * Deletes all chat messages from the Redis database for the current
   * session.
   * @returns Promise resolving when the messages have been deleted.
   */
  async clear(): Promise<void> {
    await this.ensureReadiness();
    await this.client.del(this.sessionId);
  }
}
