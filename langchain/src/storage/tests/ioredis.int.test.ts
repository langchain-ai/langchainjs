/* eslint-disable no-promise-executor-return */

import { test } from "@jest/globals";
import { Redis } from "ioredis";
import { RedisByteStore } from "../ioredis.js";

test("RedisByteStore", async () => {
  const store = new RedisByteStore({
    client: new Redis({}),
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
