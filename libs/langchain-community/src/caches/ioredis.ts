import { Redis } from "ioredis";
import {
  BaseCache,
  getCacheKey,
  serializeGeneration,
  deserializeStoredGeneration,
} from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";

/**
 * Cache LLM results using Redis.
 * @example
 * ```typescript
 * const model = new ChatOpenAI({
 *   cache: new RedisCache(new Redis(), { ttl: 60 }),
 * });
 *
 * // Invoke the model with a prompt
 * const response = await model.invoke("Do something random!");
 * console.log(response);
 *
 * // Remember to disconnect the Redis client when done
 * await redisClient.disconnect();
 * ```
 */
export class RedisCache extends BaseCache {
  protected redisClient: Redis;

  protected ttl?: number;

  constructor(
    redisClient: Redis,
    config?: {
      ttl?: number;
    }
  ) {
    super();
    this.redisClient = redisClient;
    this.ttl = config?.ttl;
  }

  /**
   * Retrieves data from the Redis server using a prompt and an LLM key. If
   * the data is not found, it returns null.
   * @param prompt The prompt used to find the data.
   * @param llmKey The LLM key used to find the data.
   * @returns The corresponding data as an array of Generation objects, or null if not found.
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
   * Updates the data in the Redis server using a prompt and an LLM key.
   * @param prompt The prompt used to store the data.
   * @param llmKey The LLM key used to store the data.
   * @param value The data to be stored, represented as an array of Generation objects.
   */
  public async update(prompt: string, llmKey: string, value: Generation[]) {
    for (let i = 0; i < value.length; i += 1) {
      const key = getCacheKey(prompt, llmKey, String(i));
      if (this.ttl !== undefined) {
        await this.redisClient.set(
          key,
          JSON.stringify(serializeGeneration(value[i])),
          "EX",
          this.ttl
        );
      } else {
        await this.redisClient.set(
          key,
          JSON.stringify(serializeGeneration(value[i]))
        );
      }
    }
  }
}
