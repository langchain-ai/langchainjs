import { Redis, type RedisConfigNodejs } from "@upstash/redis";

import { BaseCache, Generation } from "../schema/index.js";
import {
  deserializeStoredGeneration,
  getCacheKey,
  serializeGeneration,
} from "./base.js";

export type UpstashRedisCacheProps = {
  /**
   * The config to use to instantiate an Upstash Redis client.
   */
  config?: RedisConfigNodejs;
  /**
   * An existing Upstash Redis client.
   */
  client?: Redis;
};

/**
 * A cache that uses Upstash as the backing store.
 * See https://docs.upstash.com/redis.
 */
export class UpstashRedisCache extends BaseCache {
  private redisClient: Redis;

  constructor(props: UpstashRedisCacheProps) {
    super();
    const { config, client } = props;

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
    let value: string | null = await this.redisClient.get(key);
    const generations: Generation[] = [];

    while (value) {
      generations.push(deserializeStoredGeneration(JSON.parse(value)));
      idx += 1;
      key = getCacheKey(prompt, llmKey, String(idx));
      value = await this.redisClient.get(key);
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
      await this.redisClient.set(
        key,
        JSON.stringify(serializeGeneration(value[i]))
      );
    }
  }
}
