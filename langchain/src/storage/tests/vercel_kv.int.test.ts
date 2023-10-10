/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { createClient } from "@vercel/kv";
import { VercelKVStore } from "../vercel_kv.js";

test("VercelKVStore", async () => {
  const store = new VercelKVStore({
    client: createClient({
      url: process.env.VERCEL_KV_API_URL!,
      token: process.env.VERCEL_KV_API_TOKEN!,
    }),
  });
  const value1 = new Date().toISOString();
  const value2 = new Date().toISOString() + new Date().toISOString();
  await store.mset([
    ["key1", value1],
    ["key2", value2],
  ]);
  const retrievedValues = await store.mget(["key1", "key2"]);
  expect(retrievedValues).toEqual([value1, value2]);
  for await (const key of store.yieldKeys()) {
    console.log(key);
  }
  await store.mdelete(["key1", "key2"]);
  const retrievedValues2 = await store.mget(["key1", "key2"]);
  expect(retrievedValues2).toEqual([undefined, undefined]);
});
