import crypto from "crypto";
import type { RedisClientType } from "redis";
import { Generation } from "./schema/index.js";

/**
 * This cache key should be consistent across all versions of langchain.
 * It is currently NOT consistent across versions of langchain.
 *
 * A huge benefit of having a remote cache (like redis) is that you can
 * access the cache from different processes/machines. The allows you to
 * seperate concerns and scale horizontally.
 *
 * TODO: Make cache key consistent across versions of langchain.
 */

const getCacheKey = (prompt: string, llmKey: string, idx?: string): string => {
  const key = `${prompt}_${llmKey}${idx ? `_${idx}` : ""}`;
  return crypto.createHash("sha256").update(key).digest("hex");
};

export abstract class BaseCache<T = Generation[]> {
  abstract lookup(prompt: string, llmKey: string): Promise<T | null>;

  abstract update(prompt: string, llmKey: string, value: T): Promise<void>;
}

export class InMemoryCache<T = Generation[]> extends BaseCache<T> {
  #cache: Map<string, T>;

  constructor() {
    super();
    this.#cache = new Map();
  }

  lookup(prompt: string, llmKey: string): Promise<T | null> {
    return Promise.resolve(
      this.#cache.get(getCacheKey(prompt, llmKey)) ?? null
    );
  }

  async update(prompt: string, llmKey: string, value: T): Promise<void> {
    this.#cache.set(getCacheKey(prompt, llmKey), value);
  }
}

/**
 *
 * TODO: Generalize to support other types.
 */
export class RedisCache extends BaseCache<Generation[]> {
  #redisClient: RedisClientType;

  constructor(redisClient: RedisClientType) {
    super();
    this.#redisClient = redisClient;
  }

  public async lookup(
    prompt: string,
    llmKey: string
  ): Promise<Generation[] | null> {
    let idx = 0;
    let key = getCacheKey(prompt, llmKey, String(idx));
    let value = await this.#redisClient.get(key);
    const generations: Generation[] = [];

    while (value) {
      if (!value) {
        break;
      }

      generations.push({ text: value });
      idx += 1;
      key = getCacheKey(prompt, llmKey, String(idx));
      value = await this.#redisClient.get(key);
    }

    return generations.length > 0 ? generations : null;
  }

  public async update(
    prompt: string,
    llmKey: string,
    value: Generation[]
  ): Promise<void> {
    for (let i = 0; i < value.length; i += 1) {
      const key = getCacheKey(prompt, llmKey, String(i));
      await this.#redisClient.set(key, value[i].text);
    }
  }
}
