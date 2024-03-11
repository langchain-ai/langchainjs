/* eslint-disable no-process-env */
import { v4 as uuidv4 } from "uuid";
import { MongoClient, ServerApiVersion } from "mongodb";
import { Document, DocumentInterface } from "@langchain/core/documents";
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
    console.error("Failed to connect");
    throw Error(e as string);
  }

  try {
    const namespace = "langchain.test";
    const [dbName, collectionName] = namespace.split(".");
    const collection = client.db(dbName).collection(collectionName);

    const store = new MongoDBStore({
      collection,
    });

    expect(store).toBeDefined();

    const docs = [
      new Document({
        pageContent: "Dogs are tough.",
        metadata: {
          id: uuidv4(),
        },
      }),
      new Document({
        pageContent: "Cats are tough.",
        metadata: {
          id: uuidv4(),
        },
      }),
    ];
    const docsAsKVPairs: Array<[string, DocumentInterface]> = docs.map(
      (doc) => [doc.metadata.id, doc]
    );
    await store.mset(docsAsKVPairs);
    const retrievedDocs = await store.mget(docs.map((doc) => doc.metadata.id));

    expect(retrievedDocs).toEqual(docs);
  } finally {
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

  try {
    const store = new MongoDBStore({
      collection,
    });

    const docs = [
      new Document({
        pageContent: "Dogs are tough.",
        metadata: {
          id: uuidv4(),
        },
      }),
      new Document({
        pageContent: "Cats are tough.",
        metadata: {
          id: uuidv4(),
        },
      }),
    ];
    const docsAsKVPairs: Array<[string, DocumentInterface]> = docs.map(
      (doc) => [doc.metadata.id, doc]
    );
    await store.mset(docsAsKVPairs);

    const docIds = docs.map((doc) => doc.metadata.id);
    await store.mdelete(docIds);

    const retrievedDocs = await store.mget(docs.map((doc) => doc.metadata.id));

    expect(retrievedDocs.length).toBe(0);
  } finally {
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
      new Document({
        pageContent: "Dogs are tough.",
        metadata: {
          id: uuidv4(),
        },
      }),
      new Document({
        pageContent: "Cats are tough.",
        metadata: {
          id: uuidv4(),
        },
      }),
    ];
    const docsAsKVPairs: Array<[string, DocumentInterface]> = docs.map(
      (doc) => [doc.metadata.id, doc]
    );
    await store.mset(docsAsKVPairs);

    const keys = store.yieldKeys();

    const yieldedKeys = [];
    for await (const key of keys) {
      console.log("key in test");
      yieldedKeys.push(key);
    }
    expect(yieldedKeys).toEqual(docs.map((doc) => doc.metadata.id));

    // delete
    await store.mdelete(docs.map((doc) => doc.metadata.id));
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

  try {
    const store = new MongoDBStore({
      collection,
    });

    const docs = [
      new Document({
        pageContent: "Dogs are tough.",
        metadata: {
          id: "dis_one",
        },
      }),
      new Document({
        pageContent: "Cats are tough.",
        metadata: {
          id: "not_dis_one",
        },
      }),
    ];
    const docsAsKVPairs: Array<[string, DocumentInterface]> = docs.map(
      (doc) => [doc.metadata.id, doc]
    );
    await store.mset(docsAsKVPairs);

    const keys = store.yieldKeys("dis_one");

    const yieldedKeys = [];
    for await (const key of keys) {
      yieldedKeys.push(key);
    }
    expect(yieldedKeys).toEqual(["dis_one"]);

    // delete
    await store.mdelete(docs.map((doc) => doc.metadata.id));
  } finally {
    await client.close();
  }
});
