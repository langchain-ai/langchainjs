import { Redis, type RedisConfigNodejs } from "@upstash/redis"
import {
  StoredMessage,
  BaseChatMessage,
  BaseListChatMessageHistory,
} from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

export type RedisUpstashChatMessageHistoryInput = {
  sessionId: string;
  sessionTTL?: number;
  config: RedisConfigNodejs;
  client?: Redis;
};

export class RedisUpstashChatMessageHistory extends BaseListChatMessageHistory {
  public client: Redis;

  private sessionId: string;

  private sessionTTL?: number;

  constructor(fields: RedisUpstashChatMessageHistoryInput) {
    const { sessionId, sessionTTL, config, client } = fields;
    super();
    this.client = (client ?? new Redis(config));
    this.sessionId = sessionId;
    this.sessionTTL = sessionTTL;
  }


  async getMessages(): Promise<BaseChatMessage[]> {
    const rawStoredMessages = await this.client.lrange<StoredMessage>(this.sessionId, 0, -1);

    const orderedMessages = rawStoredMessages
      .reverse();
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
