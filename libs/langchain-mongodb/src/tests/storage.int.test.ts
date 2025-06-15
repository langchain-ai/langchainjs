/* eslint-disable no-process-env */
import { v4 as uuidv4 } from "uuid";
import { MongoClient, ServerApiVersion } from "mongodb";
import { MongoDBStore } from "../storage.js";

test("MongoDBStore can set and retrieve", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
  } catch (e) {
    // console.error("Failed to connect");
    throw Error(e as string);
  }

  const namespace = "langchain.test";
  const [dbName, collectionName] = namespace.split(".");
  const collection = client.db(dbName).collection(collectionName);

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

    await client.close();
  }
});

test("MongoDBStore can delete", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  const namespace = "langchain.test";
  const [dbName, collectionName] = namespace.split(".");
  const collection = client.db(dbName).collection(collectionName);

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

    await client.close();
  }
});

test("MongoDBStore can yield keys", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  const namespace = "langchain.test";
  const [dbName, collectionName] = namespace.split(".");
  const collection = client.db(dbName).collection(collectionName);

  try {
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
  } finally {
    await client.close();
  }
});

test("MongoDBStore can yield keys with prefix", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  const namespace = "langchain.test";
  const [dbName, collectionName] = namespace.split(".");
  const collection = client.db(dbName).collection(collectionName);

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
    await client.close();
  }
});
