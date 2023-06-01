import {
  createClient,
  RedisClientOptions,
  RedisClientType,
  RedisModules,
  RedisFunctions,
  RedisScripts,
} from "redis";
import {
  BaseChatMessage,
  BaseListChatMessageHistory,
} from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

export type RedisChatMessageHistoryInput = {
  sessionId: string;
  sessionTTL?: number;
  config?: RedisClientOptions;
  // Typing issues with createClient output: https://github.com/redis/node-redis/issues/1865
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
};

export class RedisChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "redis"];

  get lc_secrets() {
    return {
      "0.config.url": "REDIS_URL",
      "0.config.username": "REDIS_USERNAME",
      "0.config.password": "REDIS_PASSWORD",
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

  async ensureReadiness() {
    if (!this.client.isReady) {
      await this.client.connect();
    }
    return true;
  }

  async getMessages(): Promise<BaseChatMessage[]> {
    await this.ensureReadiness();
    const rawStoredMessages = await this.client.lRange(this.sessionId, 0, -1);
    const orderedMessages = rawStoredMessages
      .reverse()
      .map((message) => JSON.parse(message));
    return mapStoredMessagesToChatMessages(orderedMessages);
  }

  async addMessage(message: BaseChatMessage): Promise<void> {
    await this.ensureReadiness();
    const messageToAdd = mapChatMessagesToStoredMessages([message]);
    await this.client.lPush(this.sessionId, JSON.stringify(messageToAdd[0]));
    if (this.sessionTTL) {
      await this.client.expire(this.sessionId, this.sessionTTL);
    }
  }

  async clear(): Promise<void> {
    await this.ensureReadiness();
    await this.client.del(this.sessionId);
  }
}
