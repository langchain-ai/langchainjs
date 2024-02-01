/* eslint-disable no-instanceof/no-instanceof */
import {
  CacheDelete,
  CacheListFetch,
  CacheListPushBack,
  ICacheClient,
  InvalidArgumentError,
  CollectionTtl,
} from "@gomomento/sdk-core";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import { ensureCacheExists } from "../../utils/momento.js";

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

/**
 * A class that stores chat message history using Momento Cache. It
 * interacts with a Momento cache client to perform operations like
 * fetching, adding, and deleting messages.
 * @example
 * ```typescript
 * const chatHistory = await MomentoChatMessageHistory.fromProps({
 *   client: new CacheClient({
 *     configuration: Configurations.Laptop.v1(),
 *     credentialProvider: CredentialProvider.fromEnvironmentVariable({
 *       environmentVariableName: "MOMENTO_API_KEY",
 *     }),
 *     defaultTtlSeconds: 60 * 60 * 24,
 *   }),
 *   cacheName: "langchain",
 *   sessionId: new Date().toISOString(),
 *   sessionTtl: 300,
 * });
 *
 * const messages = await chatHistory.getMessages();
 * console.log({ messages });
 * ```
 */
export class MomentoChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "momento"];

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

  /**
   * Fetches messages from the cache.
   * @returns A Promise that resolves to an array of BaseMessage instances.
   */
  public async getMessages(): Promise<BaseMessage[]> {
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

  /**
   * Adds a message to the cache.
   * @param message The BaseMessage instance to add to the cache.
   * @returns A Promise that resolves when the message has been added.
   */
  public async addMessage(message: BaseMessage): Promise<void> {
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

  /**
   * Deletes all messages from the cache.
   * @returns A Promise that resolves when all messages have been deleted.
   */
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
