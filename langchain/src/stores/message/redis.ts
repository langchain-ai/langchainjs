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
  StoredMessage,
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
  public client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

  private sessionId: string;

  private sessionTTL?: number;

  constructor(fields: RedisChatMessageHistoryInput) {
    const { sessionId, sessionTTL, config, client } = fields;
    super();
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
    const previousMessages = orderedMessages
      .map((item) => ({
        type: item.type,
        data: {
          role: item.role,
          content: item.text,
        },
      }))
      .filter(
        (x): x is StoredMessage =>
          x.type !== undefined && x.data.content !== undefined
      );
    return mapStoredMessagesToChatMessages(previousMessages);
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
