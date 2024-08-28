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
    const retrievedDocs = (await store.mget(docs.map((doc) => doc[0]))).flatMap(
      (doc) => {
        if (doc !== undefined) {
          const decodedDoc = decoder.decode(doc);
          const parsedDoc = JSON.parse(decodedDoc);
          return [parsedDoc];
        }
        return [];
      }
    );

    expect(retrievedDocs.sort()).toEqual(docs.map((doc) => doc[1]).sort());
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

    expect(retrievedDocs.length).toBe(0);
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
