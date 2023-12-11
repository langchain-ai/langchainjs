import type { createCluster, createClient } from "redis";

import { BaseCache, Generation } from "../schema/index.js";
import {
  deserializeStoredGeneration,
  getCacheKey,
  serializeGeneration,
} from "./base.js";

/**
 * Represents the type of the Redis client used to interact with the Redis
 * database.
 */
type RedisClientType =
  | ReturnType<typeof createClient>
  | ReturnType<typeof createCluster>;

/**
 * Represents a specific implementation of a caching mechanism using Redis
 * as the underlying storage system. It extends the `BaseCache` class and
 * overrides its methods to provide the Redis-specific logic.
 * @example
 * ```typescript
 * const model = new ChatOpenAI({
 * cache: new RedisCache(new Redis(), { ttl: 60 }),
 * });
 *
 * // Invoke the model to perform an action
 * const response = await model.invoke("Do something random!");
 * console.log(response);
 * ```
 */
export class RedisCache extends BaseCache {
  private redisClient: RedisClientType;

  constructor(redisClient: RedisClientType) {
    super();
    this.redisClient = redisClient;
  }

  /**
   * Retrieves data from the cache. It constructs a cache key from the given
   * `prompt` and `llmKey`, and retrieves the corresponding value from the
   * Redis database.
   * @param prompt The prompt used to construct the cache key.
   * @param llmKey The LLM key used to construct the cache key.
   * @returns An array of Generations if found, null otherwise.
   */
  public async lookup(prompt: string, llmKey: string) {
    let idx = 0;
    let key = getCacheKey(prompt, llmKey, String(idx));
    let value = await this.redisClient.get(key);
    const generations: Generation[] = [];

    while (value) {
      const storedGeneration = JSON.parse(value);
      generations.push(deserializeStoredGeneration(storedGeneration));
      idx += 1;
      key = getCacheKey(prompt, llmKey, String(idx));
      value = await this.redisClient.get(key);
    }

    return generations.length > 0 ? generations : null;
  }

  /**
   * Updates the cache with new data. It constructs a cache key from the
   * given `prompt` and `llmKey`, and stores the `value` in the Redis
   * database.
   * @param prompt The prompt used to construct the cache key.
   * @param llmKey The LLM key used to construct the cache key.
   * @param value The value to be stored in the cache.
   */
  public async update(prompt: string, llmKey: string, value: Generation[]) {
    for (let i = 0; i < value.length; i += 1) {
      const key = getCacheKey(prompt, llmKey, String(i));
      await this.redisClient.set(
        key,
        JSON.stringify(serializeGeneration(value[i]))
      );
    }
  }
}
