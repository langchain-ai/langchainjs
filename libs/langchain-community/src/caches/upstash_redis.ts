import { Redis, type RedisConfigNodejs } from "@upstash/redis";

import { Generation } from "@langchain/core/outputs";
import {
  BaseCache,
  deserializeStoredGeneration,
  getCacheKey,
  serializeGeneration,
} from "@langchain/core/caches";
import { StoredGeneration } from "@langchain/core/messages";

export type UpstashRedisCacheProps = {
  /**
   * The config to use to instantiate an Upstash Redis client.
   */
  config?: RedisConfigNodejs;
  /**
   * An existing Upstash Redis client.
   */
  client?: Redis;
  /**
   * Time-to-live (TTL) for cached items in seconds.
   */
  ttl?: number;
};

/**
 * A cache that uses Upstash as the backing store.
 * See https://docs.upstash.com/redis.
 * @example
 * ```typescript
 * const cache = new UpstashRedisCache({
 *   config: {
 *     url: "UPSTASH_REDIS_REST_URL",
 *     token: "UPSTASH_REDIS_REST_TOKEN",
 *   },
 *   ttl: 3600, // Optional: Cache entries will expire after 1 hour
 * });
 * // Initialize the OpenAI model with Upstash Redis cache for caching responses
 * const model = new ChatOpenAI({
 *   model: "gpt-4o-mini",
 *   cache,
 * });
 * await model.invoke("How are you today?");
 * const cachedValues = await cache.lookup("How are you today?", "llmKey");
 * ```
 */
export class UpstashRedisCache extends BaseCache {
  private redisClient: Redis;

  private ttl?: number;

  constructor(props: UpstashRedisCacheProps) {
    super();
    const { config, client, ttl } = props;
    this.ttl = ttl;

    if (client) {
      this.redisClient = client;
    } else if (config) {
      this.redisClient = new Redis(config);
    } else {
      throw new Error(
        `Upstash Redis caches require either a config object or a pre-configured client.`
      );
    }
  }

  /**
   * Lookup LLM generations in cache by prompt and associated LLM key.
   */
  public async lookup(prompt: string, llmKey: string) {
    let idx = 0;
    let key = getCacheKey(prompt, llmKey, String(idx));
    let value = await this.redisClient.get<StoredGeneration | null>(key);
    const generations: Generation[] = [];

    while (value) {
      generations.push(deserializeStoredGeneration(value));
      idx += 1;
      key = getCacheKey(prompt, llmKey, String(idx));
      value = await this.redisClient.get<StoredGeneration | null>(key);
    }

    return generations.length > 0 ? generations : null;
  }

  /**
   * Update the cache with the given generations.
   *
   * Note this overwrites any existing generations for the given prompt and LLM key.
   */
  public async update(prompt: string, llmKey: string, value: Generation[]) {
    for (let i = 0; i < value.length; i += 1) {
      const key = getCacheKey(prompt, llmKey, String(i));
      const serializedValue = JSON.stringify(serializeGeneration(value[i]));

      if (this.ttl) {
        await this.redisClient.set(key, serializedValue, { ex: this.ttl });
      } else {
        await this.redisClient.set(key, serializedValue);
      }
    }
  }
}
