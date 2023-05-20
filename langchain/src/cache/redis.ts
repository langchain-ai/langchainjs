import type { createCluster, createClient } from "redis";

import { BaseCache, Generation } from "../schema/index.js";
import { getCacheKey } from "./base.js";

type RedisClientType =
  | ReturnType<typeof createClient>
  | ReturnType<typeof createCluster>;

export class RedisCache extends BaseCache {
  private redisClient: RedisClientType;

  constructor(redisClient: RedisClientType) {
    super();
    this.redisClient = redisClient;
  }

  public async lookup(prompt: string, llmKey: string) {
    let idx = 0;
    let key = getCacheKey(prompt, llmKey, String(idx));
    let value = await this.redisClient.get(key);
    const generations: Generation[] = [];

    while (value) {
      if (!value) {
        break;
      }

      generations.push({ text: value });
      idx += 1;
      key = getCacheKey(prompt, llmKey, String(idx));
      value = await this.redisClient.get(key);
    }

    return generations.length > 0 ? generations : null;
  }

  public async update(prompt: string, llmKey: string, value: Generation[]) {
    for (let i = 0; i < value.length; i += 1) {
      const key = getCacheKey(prompt, llmKey, String(i));
      await this.redisClient.set(key, value[i].text);
    }
  }
}
