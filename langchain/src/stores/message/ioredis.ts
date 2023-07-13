import { Redis, RedisOptions } from "ioredis";
import { BaseMessage, BaseListChatMessageHistory } from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

export type RedisChatMessageHistoryInput = {
  sessionId: string;
  sessionTTL?: number;
  url?: string;
  config?: RedisOptions;
  client?: Redis;
};

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

  async getMessages(): Promise<BaseMessage[]> {
    const rawStoredMessages = await this.client.lrange(this.sessionId, 0, -1);
    const orderedMessages = rawStoredMessages
      .reverse()
      .map((message) => JSON.parse(message));
    return mapStoredMessagesToChatMessages(orderedMessages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const messageToAdd = mapChatMessagesToStoredMessages([message]);
    await this.client.lpush(this.sessionId, JSON.stringify(messageToAdd[0]));
    if (this.sessionTTL) {
      await this.client.expire(this.sessionId, this.sessionTTL);
    }
  }

  async clear(): Promise<void> {
    await this.client.del(this.sessionId);
  }
}
