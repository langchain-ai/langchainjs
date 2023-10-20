/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { createClient } from "@vercel/kv";
import { VercelKVStore } from "../vercel_kv.js";
import { createDocumentStoreFromByteStore } from "../encoder_backed.js";
import { Document } from "../../document.js";

const getClient = () => {
  if (!process.env.VERCEL_KV_API_URL || !process.env.VERCEL_KV_API_TOKEN) {
    throw new Error(
      "VERCEL_KV_API_URL and VERCEL_KV_API_TOKEN must be set in the environment"
    );
  }
  const client = createClient({
    url: process.env.VERCEL_KV_API_URL,
    token: process.env.VERCEL_KV_API_TOKEN,
  });
  return client;
};

describe("VercelKVStore", () => {
  const client = getClient();

  afterEach(async () => await client.flushall());

  test("VercelKVStore can preform all operations", async () => {
    const store = new VercelKVStore({
      client,
    });
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    const encoder = new TextEncoder();
    await store.mset([
      ["key1", encoder.encode(value1)],
      ["key2", encoder.encode(value2)],
    ]);
    const retrievedValues = await store.mget(["key1", "key2"]);
    expect(retrievedValues).toEqual([
      encoder.encode(value1),
      encoder.encode(value2),
    ]);
    for await (const key of store.yieldKeys()) {
      console.log(key);
    }
    await store.mdelete(["key1", "key2"]);
    const retrievedValues2 = await store.mget(["key1", "key2"]);
    expect(retrievedValues2).toEqual([undefined, undefined]);
  });

  test("Encoder-backed", async () => {
    const store = createDocumentStoreFromByteStore(
      new VercelKVStore({
        client,
      })
    );
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    const [doc1, doc2] = [
      new Document({ pageContent: value1 }),
      new Document({ pageContent: value2 }),
    ];
    await store.mset([
      ["key1", doc1],
      ["key2", doc2],
    ]);
    const retrievedValues = await store.mget(["key1", "key2"]);
    expect(retrievedValues).toEqual([doc1, doc2]);
    for await (const key of store.yieldKeys()) {
      console.log(key);
    }
    await store.mdelete(["key1", "key2"]);
    const retrievedValues2 = await store.mget(["key1", "key2"]);
    expect(retrievedValues2).toEqual([undefined, undefined]);
  });

  test("VercelKVStore can yield keys with prefix", async () => {
    const prefix = "prefix_";
    const prefixedKeys = [`${prefix}key1`, `${prefix}key2`];
    const store = new VercelKVStore({
      client,
    });
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    const encoder = new TextEncoder();
    await store.mset([
      [prefixedKeys[0], encoder.encode(value1)],
      [prefixedKeys[1], encoder.encode(value2)],
    ]);
    const retrievedValues = await store.mget(prefixedKeys);
    expect(retrievedValues).toEqual([
      encoder.encode(value1),
      encoder.encode(value2),
    ]);
    const yieldedKeys = [];
    for await (const key of store.yieldKeys(prefix)) {
      yieldedKeys.push(key);
    }
    console.log(yieldedKeys);
    expect(yieldedKeys).toEqual(expect.arrayContaining(prefixedKeys));
    await store.mdelete(prefixedKeys);
    const retrievedValues2 = await store.mget(prefixedKeys);
    expect(retrievedValues2).toEqual([undefined, undefined]);
  });
});
