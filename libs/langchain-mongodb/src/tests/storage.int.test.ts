/* eslint-disable no-process-env */
import { v4 as uuidv4 } from "uuid";
import { Collection, MongoClient, ServerApiVersion } from "mongodb";
import { MongoDBStore } from "../storage.js";
import { uri } from "./utils.js";

let client: MongoClient;
let collection: Collection;

beforeAll(async () => {
  client = new MongoClient(uri(), {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  collection = await client.db("langchain_test").createCollection("storage");
});

afterAll(async () => {
  await client.close();
});

test("MongoDBStore can set and retrieve", async () => {
  const store = new MongoDBStore({
    collection,
  });
  expect(store).toBeDefined();

  try {
    const docs = [
      [uuidv4(), "Dogs are tough."],
      [uuidv4(), "Cats are tough."],
    ];
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const docsAsKVPairs: Array<[string, Uint8Array]> = docs.map((doc) => [
      doc[0],
      encoder.encode(doc[1]),
    ]);
    await store.mset(docsAsKVPairs);

    const keysToRetrieve = docs.map((doc) => doc[0]);
    keysToRetrieve.unshift("nonexistent_key_0");
    keysToRetrieve.push("nonexistent_key_3");

    const retrievedDocs = await store.mget(keysToRetrieve);
    expect(retrievedDocs.length).toBe(keysToRetrieve.length);
    // Check that the first item is undefined (nonexistent_key_0)
    expect(retrievedDocs[0]).toBeUndefined();

    // Check that the second and third items match the original docs
    expect(decoder.decode(retrievedDocs[1])).toBe(docs[0][1]);
    expect(decoder.decode(retrievedDocs[2])).toBe(docs[1][1]);

    // Check that the last item is undefined (nonexistent_key_1)
    expect(retrievedDocs[retrievedDocs.length - 1]).toBeUndefined();
  } finally {
    const keys = store.yieldKeys();
    const yieldedKeys = [];
    for await (const key of keys) {
      yieldedKeys.push(key);
    }
    await store.mdelete(yieldedKeys);
  }
});

test("MongoDBStore can delete", async () => {
  const store = new MongoDBStore({
    collection,
  });

  try {
    const docs = [
      [uuidv4(), "Dogs are tough."],
      [uuidv4(), "Cats are tough."],
    ];
    const encoder = new TextEncoder();
    const docsAsKVPairs: Array<[string, Uint8Array]> = docs.map((doc) => [
      doc[0],
      encoder.encode(doc[1]),
    ]);
    await store.mset(docsAsKVPairs);

    const docIds = docs.map((doc) => doc[0]);
    await store.mdelete(docIds);

    const retrievedDocs = await store.mget(docs.map((doc) => doc[0]));

    expect(retrievedDocs.length).toBe(2);
    const everyValueUndefined = retrievedDocs.every((v) => v === undefined);
    expect(everyValueUndefined).toBe(true);
  } finally {
    const keys = store.yieldKeys();
    const yieldedKeys = [];
    for await (const key of keys) {
      yieldedKeys.push(key);
    }
    await store.mdelete(yieldedKeys);
  }
});

test("MongoDBStore can yield keys", async () => {
  const store = new MongoDBStore({
    collection,
  });

  const docs = [
    [uuidv4(), "Dogs are tough."],
    [uuidv4(), "Cats are tough."],
  ];
  const encoder = new TextEncoder();
  const docsAsKVPairs: Array<[string, Uint8Array]> = docs.map((doc) => [
    doc[0],
    encoder.encode(doc[1]),
  ]);
  await store.mset(docsAsKVPairs);

  const keys = store.yieldKeys();

  const yieldedKeys = [];
  for await (const key of keys) {
    yieldedKeys.push(key);
  }

  expect(yieldedKeys.sort()).toEqual(docs.map((doc) => doc[0]).sort());

  // delete
  await store.mdelete(yieldedKeys);
});

test("MongoDBStore can yield keys with prefix", async () => {
  const store = new MongoDBStore({
    collection,
  });

  try {
    const docs = [
      ["dis_one", "Dogs are tough."],
      ["not_dis_one", "Cats are tough."],
    ];
    const encoder = new TextEncoder();
    const docsAsKVPairs: Array<[string, Uint8Array]> = docs.map((doc) => [
      doc[0],
      encoder.encode(doc[1]),
    ]);
    await store.mset(docsAsKVPairs);

    const keys = store.yieldKeys("dis_one");

    const yieldedKeys = [];
    for await (const key of keys) {
      yieldedKeys.push(key);
    }
    expect(yieldedKeys).toEqual(["dis_one"]);
  } finally {
    const keys = store.yieldKeys();
    const yieldedKeys = [];
    for await (const key of keys) {
      yieldedKeys.push(key);
    }
    await store.mdelete(yieldedKeys);
  }
});
