/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import { createClient } from "@vercel/kv";
import { VercelKVStore } from "../vercel_kv.js";
import { createDocumentStoreFromByteStore } from "../encoder_backed.js";
import { Document } from "../../document.js";

test("VercelKVStore", async () => {
  const store = new VercelKVStore({
    client: createClient({
      url: process.env.VERCEL_KV_API_URL!,
      token: process.env.VERCEL_KV_API_TOKEN!,
    }),
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
      client: createClient({
        url: process.env.VERCEL_KV_API_URL!,
        token: process.env.VERCEL_KV_API_TOKEN!,
      }),
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
