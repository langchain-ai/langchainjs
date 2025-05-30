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
    monitorCommands: true,
  });
  await client.connect();
  collection = await client.db("langchain").createCollection("storage");
});

afterEach(async () => {
  await collection.deleteMany({});
});

afterAll(async () => {
  await client.close();
});

describe("mget()", () => {
  test("returns [] when no keys are specified", async () => {
    const store = new MongoDBStore({
      collection,
    });
    await store.mset(makeTestDocuments(10));
    const result = await store.mget([]);
    expect(result).toEqual([]);
  });

  test("returns an array of undefined when no specified keys exist in the store", async () => {
    const store = new MongoDBStore({
      collection,
    });
    await store.mset(makeTestDocuments(10));
    const result = await store.mget(["nonexistent_key_1", "nonexistent_key_2"]);
    expect(result).toEqual([undefined, undefined]);
  });

  test("returns matches when specified keys exist in the store", async () => {
    const store = new MongoDBStore({
      collection,
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);
    const keysToGet = documents.slice(0, 2).map((doc) => doc[0]);
    const expectedValues = documents.slice(0, 2).map((doc) => doc[1]);
    const result = await store.mget(keysToGet);
    expect(result).toEqual(expectedValues);
  });

  test("returns a sparse array when some specified keys exist in the store", async () => {
    const store = new MongoDBStore({
      collection,
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);
    const keysToGet = documents.slice(0, 2).map((doc) => doc[0]);
    const expectedValues = documents.slice(0, 2).map((doc) => doc[1]);
    const result = await store.mget([
      keysToGet[0],
      "nonexistent_key_1",
      keysToGet[1],
      "nonexistent_key_2",
    ]);
    expect(result).toEqual([
      expectedValues[0],
      undefined,
      expectedValues[1],
      undefined,
    ]);
  });

  test("returns matching documents when `primaryKey` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      primaryKey: "customPrimaryKey",
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);
    const keysToGet = documents.slice(0, 2).map((doc) => doc[0]);
    const expectedValues = documents.slice(0, 2).map((doc) => doc[1]);
    const result = await store.mget(keysToGet);
    expect(result).toEqual(expectedValues);
  });

  test("returns matching documents when `namespace` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      namespace: "customNamespace",
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);
    const keysToGet = documents.slice(0, 2).map((doc) => doc[0]);
    const expectedValues = documents.slice(0, 2).map((doc) => doc[1]);
    const result = await store.mget(keysToGet);
    expect(result).toEqual(expectedValues);
  });
});

describe("mset()", () => {
  test("throws an error when no kv pairs are specified", async () => {
    const store = new MongoDBStore({
      collection,
    });
    const error = await store.mset([]).catch((e) => e);
    expect(error.message).toEqual(
      "Invalid BulkOperation, Batch cannot be empty"
    );
  });

  test("upserts kv pairs if they don't exist in the db", async () => {
    const store = new MongoDBStore({
      collection,
    });
    expect(await collection.countDocuments()).toEqual(0);

    const documents = makeTestDocuments(10);
    await store.mset(documents);
    const yieldedKeys = await arrayFromAsyncGenerator(store.yieldKeys());
    expect(new Set(yieldedKeys)).toEqual(
      new Set(documents.map((doc) => doc[0]))
    );
  });

  test("updates kv pairs if they do exist in the db", async () => {
    const store = new MongoDBStore({
      collection,
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);
    const updatedDocuments: Array<[string, Uint8Array]> = documents.map(
      (doc) => [doc[0], new TextEncoder().encode("updated value")]
    );
    await store.mset(updatedDocuments);

    expect(await collection.countDocuments()).toEqual(10);

    const values = await store.mget(documents.map((doc) => doc[0]));
    expect(new Set(values)).toEqual(
      new Set(updatedDocuments.map((doc) => doc[1]))
    );
  });

  test("invalid utf8 data is replaced with replacement character", async () => {
    const store = new MongoDBStore({
      collection,
    });

    // meta - we must ensure that the data is not valid utf8 and will throw if a textdecoder is
    const invalidUtf8Data = new Uint8Array([0xff, 0xfe, 0xfd]);
    expect(() =>
      new TextDecoder("utf-8", { fatal: true }).decode(invalidUtf8Data)
    ).toThrow();

    const documents: Array<[string, Uint8Array]> = [
      [uuidv4(), invalidUtf8Data],
    ];
    await store.mset(documents);

    const result = await store.mget([documents[0][0]]);
    expect(result[0]).toEqual(new TextEncoder().encode("\uFFFD\uFFFD\uFFFD"));
  });

  test("populates the store with a namespaced key when `namespace` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      namespace: "customNamespace",
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);

    const [document] = await collection.find().limit(1).toArray();

    // By default, mongodb's collection is an ObjectId.  But the store
    // automatically inserts _id as a string, unless a custom primaryKey is set.
    expect(
      (document._id as unknown as string).startsWith("customNamespace/")
    ).toBe(true);
  });

  test("populates the store with the primaryKey set when `primaryKey` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      primaryKey: "customPrimaryKey",
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);

    const [document] = await collection.find().limit(1).toArray();

    expect(document.customPrimaryKey).toBeDefined();
  });
});

describe("mdelete()", () => {
  test("deletes nothing when no keys are specified", async () => {
    const store = new MongoDBStore({
      collection,
    });
    await store.mset(makeTestDocuments(10));
    await store.mdelete([]);

    expect(await collection.countDocuments()).toEqual(10);
  });
  test("deletes only matching keys", async () => {
    const store = new MongoDBStore({
      collection,
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);
    const keysToDelete = documents.slice(0, 2).map((doc) => doc[0]);
    const expectedRemainingKeys = documents.slice(2).map((doc) => doc[0]);
    await store.mdelete(keysToDelete);
    const yieldedKeys = await arrayFromAsyncGenerator(store.yieldKeys());
    expect(new Set(yieldedKeys)).toEqual(new Set(expectedRemainingKeys));
  });
  test("deletes keys with prefix when `namespace` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      namespace: "customNamespace",
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);

    const keysToDelete = documents.slice(0, 2).map((doc) => doc[0]);
    const expectedRemainingKeys = documents.slice(2).map((doc) => doc[0]);

    await store.mdelete(keysToDelete);
    const yieldedKeys = await arrayFromAsyncGenerator(store.yieldKeys());
    expect(new Set(yieldedKeys)).toEqual(new Set(expectedRemainingKeys));
  });
  test("deletes keys with primaryKey when `primaryKey` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      primaryKey: "customPrimaryKey",
    });
    const documents = makeTestDocuments(10);
    await store.mset(documents);

    const keysToDelete = documents.slice(0, 2).map((doc) => doc[0]);
    const expectedRemainingKeys = documents.slice(2).map((doc) => doc[0]);

    await store.mdelete(keysToDelete);
    const yieldedKeys = await arrayFromAsyncGenerator(store.yieldKeys());
    expect(new Set(yieldedKeys)).toEqual(new Set(expectedRemainingKeys));
  });
});

describe("yieldKeys()", () => {
  test("yields all keys when no prefix is specified", async () => {
    const store = new MongoDBStore({
      collection,
    });
    const documents = makeTestDocuments(10);
    const expectedKeys = documents.map((doc) => doc[0]);
    await store.mset(documents);
    const keys = store.yieldKeys();
    const yieldedKeys = await arrayFromAsyncGenerator(keys);
    expect(new Set(yieldedKeys)).toEqual(new Set(expectedKeys));
  });

  test("yields only matching keys when a prefix is specified", async () => {
    const store = new MongoDBStore({
      collection,
    });
    const documents = makeTestDocuments(10);
    documents[0][0] = "prefix_1";
    documents[1][0] = "prefix_2";
    documents[2][0] = "prefix_3";

    await store.mset(documents);
    const keys = store.yieldKeys("prefix");
    const yieldedKeys = await arrayFromAsyncGenerator(keys);
    expect(new Set(yieldedKeys)).toEqual(
      new Set(["prefix_1", "prefix_2", "prefix_3"])
    );
  });

  test("yields only matching keys when `primaryKey` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      primaryKey: "customPrimaryKey",
    });
    const documents = makeTestDocuments(10);
    documents[0][0] = "prefix_1";
    documents[1][0] = "prefix_2";
    documents[2][0] = "prefix_3";

    await store.mset(documents);
    const keys = store.yieldKeys("prefix");
    const yieldedKeys = await arrayFromAsyncGenerator(keys);
    expect(new Set(yieldedKeys)).toEqual(
      new Set(["prefix_1", "prefix_2", "prefix_3"])
    );
  });
  test("yields only matching keys when `namespace` is set to a non-default value", async () => {
    const store = new MongoDBStore({
      collection,
      namespace: "customNamespace",
    });
    const documents = makeTestDocuments(10);
    documents[0][0] = "prefix_1";
    documents[1][0] = "prefix_2";
    documents[2][0] = "prefix_3";

    await store.mset(documents);
    const keys = store.yieldKeys("prefix");
    const yieldedKeys = await arrayFromAsyncGenerator(keys);
    expect(new Set(yieldedKeys)).toEqual(
      new Set(["prefix_1", "prefix_2", "prefix_3"])
    );
  });

  test("batches are fetched in batches of `yieldKeysScanBatchSize`", async () => {
    const events: { batchSize: number; command: "find" | "getMore" }[] = [];
    client.on("commandStarted", (event) => {
      if (["find", "getMore"].includes(event.commandName))
        events.push({
          batchSize: event.command.batchSize,
          command: event.commandName as unknown as "find" | "getMore",
        });
    });

    const store = new MongoDBStore({
      collection,
      yieldKeysScanBatchSize: 2,
    });
    const documents = makeTestDocuments(5);
    await store.mset(documents);
    const keys = store.yieldKeys();
    await arrayFromAsyncGenerator(keys);

    expect(events).toEqual([
      {
        batchSize: 2,
        command: "find",
      },
      {
        batchSize: 2,
        command: "getMore",
      },
      {
        batchSize: 2,
        command: "getMore",
      },
    ]);
  });
});

async function arrayFromAsyncGenerator<T>(gen: AsyncGenerator<T>) {
  const arr: T[] = [];
  for await (const item of gen) {
    arr.push(item);
  }
  return arr;
}

function makeTestDocuments(n: number) {
  const docs: Array<[string, Uint8Array]> = [];
  const encoder = new TextEncoder();
  for (let i = 0; i < n; i += 1) {
    docs.push([uuidv4(), encoder.encode(`Dogs are tough ${i}.`)]);
  }
  return docs;
}
