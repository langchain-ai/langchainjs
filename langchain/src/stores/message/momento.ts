/* eslint-disable no-instanceof/no-instanceof */
import {
  CacheDelete,
  CacheListFetch,
  CacheListPushBack,
  ICacheClient,
  InvalidArgumentError,
  CollectionTtl,
} from "@gomomento/sdk";
import {
  BaseChatMessage,
  BaseListChatMessageHistory,
  StoredMessage,
} from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";
import { ensureCacheExists } from "../../util/momento.js";

/**
 * The settings to instantiate the Momento chat message history.
 */
export interface MomentoChatMessageHistoryProps {
  /**
   * The session ID to use to store the data.
   */
  sessionId: string;
  /**
   * The Momento cache client.
   */
  client: ICacheClient;
  /**
   * The name of the cache to use to store the data.
   */
  cacheName: string;
  /**
   * The time to live for the cache items in seconds.
   * If not specified, the cache client default is used.
   */
  sessionTtl?: number;
  /**
   * If true, ensure that the cache exists before returning.
   * If false, the cache is not checked for existence.
   * Defaults to true.
   */
  ensureCacheExists?: true;
}

export class MomentoChatMessageHistory extends BaseListChatMessageHistory {
  private readonly sessionId: string;

  private readonly client: ICacheClient;

  private readonly cacheName: string;

  private readonly sessionTtl: CollectionTtl;

  private constructor(props: MomentoChatMessageHistoryProps) {
    super();
    this.sessionId = props.sessionId;
    this.client = props.client;
    this.cacheName = props.cacheName;

    this.validateTtlSeconds(props.sessionTtl);
    this.sessionTtl =
      props.sessionTtl !== undefined
        ? CollectionTtl.of(props.sessionTtl)
        : CollectionTtl.fromCacheTtl();
  }

  /**
   * Create a new chat message history backed by Momento.
   *
   * @param {MomentoCacheProps} props The settings to instantiate the Momento chat message history.
   * @param {string} props.sessionId The session ID to use to store the data.
   * @param {ICacheClient} props.client The Momento cache client.
   * @param {string} props.cacheName The name of the cache to use to store the data.
   * @param {number} props.sessionTtl The time to live for the cache items in seconds.
   * If not specified, the cache client default is used.
   * @param {boolean} props.ensureCacheExists If true, ensure that the cache exists before returning.
   * If false, the cache is not checked for existence.
   * @throws {InvalidArgumentError} If {@link props.sessionTtl} is not strictly positive.
   * @returns A new chat message history backed by Momento.
   */
  public static async fromProps(
    props: MomentoChatMessageHistoryProps
  ): Promise<MomentoChatMessageHistory> {
    const instance = new MomentoChatMessageHistory(props);
    if (props.ensureCacheExists || props.ensureCacheExists === undefined) {
      await ensureCacheExists(props.client, props.cacheName);
    }
    return instance;
  }

  /**
   * Validate the user-specified TTL, if provided, is strictly positive.
   * @param ttlSeconds The TTL to validate.
   */
  private validateTtlSeconds(ttlSeconds?: number): void {
    if (ttlSeconds !== undefined && ttlSeconds <= 0) {
      throw new InvalidArgumentError("ttlSeconds must be positive.");
    }
  }

  public async getMessages(): Promise<BaseChatMessage[]> {
    const fetchResponse = await this.client.listFetch(
      this.cacheName,
      this.sessionId
    );

    let messages: StoredMessage[] = [];
    if (fetchResponse instanceof CacheListFetch.Hit) {
      messages = fetchResponse
        .valueList()
        .map((serializedStoredMessage) => JSON.parse(serializedStoredMessage));
    } else if (fetchResponse instanceof CacheListFetch.Miss) {
      // pass
    } else if (fetchResponse instanceof CacheListFetch.Error) {
      throw fetchResponse.innerException();
    } else {
      throw new Error(`Unknown response type: ${fetchResponse.toString()}`);
    }
    return mapStoredMessagesToChatMessages(messages);
  }

  public async addMessage(message: BaseChatMessage): Promise<void> {
    const messageToAdd = JSON.stringify(
      mapChatMessagesToStoredMessages([message])[0]
    );

    const pushResponse = await this.client.listPushBack(
      this.cacheName,
      this.sessionId,
      messageToAdd,
      { ttl: this.sessionTtl }
    );
    if (pushResponse instanceof CacheListPushBack.Success) {
      // pass
    } else if (pushResponse instanceof CacheListPushBack.Error) {
      throw pushResponse.innerException();
    } else {
      throw new Error(`Unknown response type: ${pushResponse.toString()}`);
    }
  }

  public async clear(): Promise<void> {
    const deleteResponse = await this.client.delete(
      this.cacheName,
      this.sessionId
    );
    if (deleteResponse instanceof CacheDelete.Success) {
      // pass
    } else if (deleteResponse instanceof CacheDelete.Error) {
      throw deleteResponse.innerException();
    } else {
      throw new Error(`Unknown response type: ${deleteResponse.toString()}`);
    }
  }
}
