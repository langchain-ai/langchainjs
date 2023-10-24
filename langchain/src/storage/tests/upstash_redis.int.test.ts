/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { Redis as UpstashRedis } from "@upstash/redis";
import { UpstashRedisStore } from "../upstash_redis.js";

const getClient = () => {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new Error("Missing Upstash Redis env variables.");
  }

  const config = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  return new UpstashRedis(config);
};

describe.skip("UpstashRedisStore", () => {
  const keys = ["key1", "key2"];
  const client = getClient();

  afterEach(async () => {
    await client.del(...keys);
  });

  test("UpstashRedis can write & read values", async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const store = new UpstashRedisStore({
      client,
    });
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], encoder.encode(value1)],
      [keys[1], encoder.encode(value2)],
    ]);
    const retrievedValues = await store.mget([keys[0], keys[1]]);
    const everyValueDefined = retrievedValues.every((v) => v !== undefined);
    expect(everyValueDefined).toBe(true);
    expect(retrievedValues.map((v) => decoder.decode(v))).toEqual([
      value1,
      value2,
    ]);
  });

  test("UpstashRedis can delete values", async () => {
    const encoder = new TextEncoder();
    const store = new UpstashRedisStore({
      client,
    });
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], encoder.encode(value1)],
      [keys[1], encoder.encode(value2)],
    ]);
    await store.mdelete(keys);
    const retrievedValues = await store.mget([keys[0], keys[1]]);
    const everyValueUndefined = retrievedValues.every((v) => v === undefined);
    expect(everyValueUndefined).toBe(true);
  });

  test("UpstashRedis can yield keys with prefix", async () => {
    const prefix = "prefix_";
    const keysWithPrefix = keys.map((key) => `${prefix}${key}`);
    const encoder = new TextEncoder();
    const store = new UpstashRedisStore({
      client,
    });
    const value = new Date().toISOString();
    await store.mset(keysWithPrefix.map((key) => [key, encoder.encode(value)]));
    const yieldedKeys = [];
    for await (const key of store.yieldKeys(prefix)) {
      yieldedKeys.push(key);
    }
    console.log("Yielded keys:", yieldedKeys);
    expect(yieldedKeys.sort()).toEqual(keysWithPrefix.sort());
    // afterEach won't automatically delete these since we're applying a prefix.
    await store.mdelete(keysWithPrefix);
  });
});
