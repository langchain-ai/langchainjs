/* eslint-disable no-promise-executor-return */

import { test } from "@jest/globals";
import { Redis } from "ioredis";
import { RedisByteStore } from "../ioredis.js";

describe("RedisByteStore", () => {
  const client = new Redis({});

  afterEach(async () => await client.flushall());

  afterAll(() => client.disconnect());

  test("RedisByteStore", async () => {
    const store = new RedisByteStore({
      client,
    });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      ["key1", encoder.encode(value1)],
      ["key2", encoder.encode(value2)],
    ]);
    const retrievedValues = await store.mget(["key1", "key2"]);
    expect(retrievedValues.map((v) => decoder.decode(v))).toEqual([
      value1,
      value2,
    ]);
    for await (const key of store.yieldKeys()) {
      console.log(key);
    }
    await store.mdelete(["key1", "key2"]);
    const retrievedValues2 = await store.mget(["key1", "key2"]);
    expect(retrievedValues2).toEqual([undefined, undefined]);
  });

  test("RedisByteStore yield keys with prefix", async () => {
    const prefix = "prefix_";
    const prefixedKeys = [`${prefix}key1`, `${prefix}key2`];
    const store = new RedisByteStore({
      client,
    });
    const encoder = new TextEncoder();
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [prefixedKeys[0], encoder.encode(value1)],
      [prefixedKeys[1], encoder.encode(value2)],
    ]);

    const yieldedKeys = [];
    for await (const key of store.yieldKeys(prefix)) {
      yieldedKeys.push(key);
    }
    console.log(yieldedKeys);
    expect(yieldedKeys).toEqual(expect.arrayContaining(prefixedKeys));
  });
});
