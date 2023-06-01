import { Redis, type RedisConfigNodejs } from "@upstash/redis";
import {
  StoredMessage,
  BaseChatMessage,
  BaseListChatMessageHistory,
} from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

export type UpstashRedisChatMessageHistoryInput = {
  sessionId: string;
  sessionTTL?: number;
  config?: RedisConfigNodejs;
  client?: Redis;
};

export class UpstashRedisChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "upstash_redis"];

  get lc_secrets() {
    return {
      "0.config.url": "UPSTASH_REDIS_REST_URL",
      "0.config.token": "UPSTASH_REDIS_REST_TOKEN",
    };
  }

  public client: Redis;

  private sessionId: string;

  private sessionTTL?: number;

  constructor(fields: UpstashRedisChatMessageHistoryInput) {
    super(fields);
    const { sessionId, sessionTTL, config, client } = fields;
    if (client) {
      this.client = client;
    } else if (config) {
      this.client = new Redis(config);
    } else {
      throw new Error(
        `Upstash Redis message stores require either a config object or a pre-configured client.`
      );
    }
    this.sessionId = sessionId;
    this.sessionTTL = sessionTTL;
  }

  async getMessages(): Promise<BaseChatMessage[]> {
    const rawStoredMessages: StoredMessage[] =
      await this.client.lrange<StoredMessage>(this.sessionId, 0, -1);

    const orderedMessages = rawStoredMessages.reverse();
    const previousMessages = orderedMessages
      .map((item) => ({
        type: item.type,
        data: {
          role: item.data.role,
          content: item.data.content,
        },
      }))
      .filter(
        (x): x is StoredMessage =>
          x.type !== undefined && x.data.content !== undefined
      );
    return mapStoredMessagesToChatMessages(previousMessages);
  }

  async addMessage(message: BaseChatMessage): Promise<void> {
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
