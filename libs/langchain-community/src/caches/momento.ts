/* eslint-disable no-instanceof/no-instanceof */
import {
  ICacheClient,
  CacheGet,
  CacheSet,
  InvalidArgumentError,
} from "@gomomento/sdk-core";

import {
  BaseCache,
  deserializeStoredGeneration,
  getCacheKey,
  serializeGeneration,
} from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";

import { ensureCacheExists } from "../utils/momento.js";

/**
 * The settings to instantiate the Momento standard cache.
 */
export interface MomentoCacheProps {
  /**
   * The Momento cache client.
   */
  client: ICacheClient;
  /**
   * The name of the cache to use to store the data.
   */
  cacheName: string;
  /**
   * The time to live for the cache items. If not specified,
   * the cache client default is used.
   */
  ttlSeconds?: number;
  /**
   * If true, ensure that the cache exists before returning.
   * If false, the cache is not checked for existence.
   * Defaults to true.
   */
  ensureCacheExists?: true;
}

/**
 * A cache that uses Momento as the backing store.
 * See https://gomomento.com.
 * @example
 * ```typescript
 * const cache = new MomentoCache({
 *   client: new CacheClient({
 *     configuration: Configurations.Laptop.v1(),
 *     credentialProvider: CredentialProvider.fromEnvironmentVariable({
 *       environmentVariableName: "MOMENTO_API_KEY",
 *     }),
 *     defaultTtlSeconds: 60 * 60 * 24, // Cache TTL set to 24 hours.
 *   }),
 *   cacheName: "langchain",
 * });
 * // Initialize the OpenAI model with Momento cache for caching responses
 * const model = new ChatOpenAI({
 *   cache,
 * });
 * await model.invoke("How are you today?");
 * const cachedValues = await cache.lookup("How are you today?", "llmKey");
 * ```
 */
export class MomentoCache extends BaseCache {
  private client: ICacheClient;

  private readonly cacheName: string;

  private readonly ttlSeconds?: number;

  private constructor(props: MomentoCacheProps) {
    super();
    this.client = props.client;
    this.cacheName = props.cacheName;

    this.validateTtlSeconds(props.ttlSeconds);
    this.ttlSeconds = props.ttlSeconds;
  }

  /**
   * Create a new standard cache backed by Momento.
   *
   * @param {MomentoCacheProps} props The settings to instantiate the cache.
   * @param {ICacheClient} props.client The Momento cache client.
   * @param {string} props.cacheName The name of the cache to use to store the data.
   * @param {number} props.ttlSeconds The time to live for the cache items. If not specified,
   * the cache client default is used.
   * @param {boolean} props.ensureCacheExists If true, ensure that the cache exists before returning.
   * If false, the cache is not checked for existence. Defaults to true.
   * @throws {@link InvalidArgumentError} if {@link props.ttlSeconds} is not strictly positive.
   * @returns The Momento-backed cache.
   */
  public static async fromProps(
    props: MomentoCacheProps
  ): Promise<MomentoCache> {
    const instance = new MomentoCache(props);
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
   * Lookup LLM generations in cache by prompt and associated LLM key.
   * @param prompt The prompt to lookup.
   * @param llmKey The LLM key to lookup.
   * @returns The generations associated with the prompt and LLM key, or null if not found.
   */
  public async lookup(
    prompt: string,
    llmKey: string
  ): Promise<Generation[] | null> {
    const key = getCacheKey(prompt, llmKey);
    const getResponse = await this.client.get(this.cacheName, key);

    if (getResponse instanceof CacheGet.Hit) {
      const value = getResponse.valueString();
      const parsedValue = JSON.parse(value);
      if (!Array.isArray(parsedValue)) {
        return null;
      }
      return JSON.parse(value).map(deserializeStoredGeneration);
    } else if (getResponse instanceof CacheGet.Miss) {
      return null;
    } else if (getResponse instanceof CacheGet.Error) {
      throw getResponse.innerException();
    } else {
      throw new Error(`Unknown response type: ${getResponse.toString()}`);
    }
  }

  /**
   * Update the cache with the given generations.
   *
   * Note this overwrites any existing generations for the given prompt and LLM key.
   *
   * @param prompt The prompt to update.
   * @param llmKey The LLM key to update.
   * @param value The generations to store.
   */
  public async update(
    prompt: string,
    llmKey: string,
    value: Generation[]
  ): Promise<void> {
    const key = getCacheKey(prompt, llmKey);
    const setResponse = await this.client.set(
      this.cacheName,
      key,
      JSON.stringify(value.map(serializeGeneration)),
      { ttl: this.ttlSeconds }
    );

    if (setResponse instanceof CacheSet.Success) {
      // pass
    } else if (setResponse instanceof CacheSet.Error) {
      throw setResponse.innerException();
    } else {
      throw new Error(`Unknown response type: ${setResponse.toString()}`);
    }
  }
}
