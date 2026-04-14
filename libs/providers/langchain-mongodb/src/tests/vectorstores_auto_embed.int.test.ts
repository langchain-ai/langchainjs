import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
  test,
} from "vitest";
import { Collection, MongoClient } from "mongodb";
import { Document } from "@langchain/core/documents";
import { Document as BSONDocument } from "bson";
import semver from "semver";

import { MongoDBAtlasVectorSearch } from "../vectorstores.js";
import {
  uri,
  waitForIndexToBeQueryable,
  waitForDocumentsIndexed,
} from "./utils.js";

/**
 * The following json can be used to create an index in atlas for Cohere embeddings.
 * Use "langchain.test" for the namespace and "default" for the index name.

{
  "mappings": {
    "fields": {
      "e": { "type": "number" },
      "embedding": {
        "dimensions": 1536,
        "similarity": "euclidean",
        "type": "knnVector"
      }
    }
  }
}
*/

const tempClient = new MongoClient(uri());
await tempClient.connect();
const admin = tempClient.db().admin();
const serverStatus = await admin.serverStatus();
const version = serverStatus.version || "unknown";
const runAutoEmbedTests = semver.gte(version, "8.2.0");
const skipAutoEmbedTests = !runAutoEmbedTests;
await tempClient.close();

describe.skipIf(skipAutoEmbedTests)("Auto Embedding Tests with data", () => {
  const defaultEmbeddingModel = "voyage-4";

  let client: MongoClient;
  let collection: Collection;
  beforeAll(async () => {
    client = new MongoClient(uri(), { monitorCommands: true });
    await client.connect();

    const namespace = "langchain_test_db.langchain_auto_embed_test";
    const [dbName, collectionName] = namespace.split(".");
    const db = client.db(dbName);

    // Drop and recreate collection to ensure clean state and no lingering indexes
    try {
      await db.dropCollection(collectionName);
    } catch {
      // Collection may not exist, which is fine
    }

    collection = await db.createCollection(collectionName);

    // Create search index with autoEmbed for auto-embedding
    // This is the correct format for MongoDB's vectorSearch with auto-embedding
    await collection.createSearchIndex({
      name: "default",
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "autoEmbed",
            modality: "text",
            path: "text",
            model: defaultEmbeddingModel,
          },
        ],
      },
    });

    await waitForIndexToBeQueryable(collection, "default");
  });

  beforeEach(async () => {
    await collection.deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  test("MongoDBStore sets client metadata", () => {
    const spy = vi.spyOn(client!, "appendMetadata");
    new MongoDBAtlasVectorSearch({ collection });
    expect(spy).toHaveBeenCalledWith({ name: "langchainjs_vector" });
    vi.clearAllMocks();
  });

  test("MongoDBAtlasVectorSearch with external ids", async () => {
    const vectorStore = new MongoDBAtlasVectorSearch({ collection });

    expect(vectorStore).toBeDefined();

    // check if the database is empty
    await collection.deleteMany({});

    await vectorStore.addDocuments([
      {
        pageContent: "Dogs are tough.",
        metadata: { a: 1, created_at: new Date().toISOString() },
      },
      {
        pageContent: "Cats have fluff.",
        metadata: { b: 1, created_at: new Date().toISOString() },
      },
      {
        pageContent: "What is a sandwich?",
        metadata: { c: 1, created_at: new Date().toISOString() },
      },
      {
        pageContent: "That fence is purple.",
        metadata: { d: 1, e: 2, created_at: new Date().toISOString() },
      },
    ]);

    await waitForDocumentsIndexed(vectorStore, "Sandwich");

    const results: Document[] = await vectorStore.similaritySearch(
      "Sandwich",
      1
    );

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
    ]);
  });

  test("MongoDBAtlasVectorSearch similaritySearchWithScore", async () => {
    const vectorStore = new MongoDBAtlasVectorSearch({ collection });

    expect(vectorStore).toBeDefined();

    // check if the database is empty
    await collection.deleteMany({});

    await vectorStore.addDocuments([
      {
        pageContent: "Dogs are tough.",
        metadata: { a: 1, created_at: new Date().toISOString() },
      },
      {
        pageContent: "Cats have fluff.",
        metadata: { b: 1, created_at: new Date().toISOString() },
      },
      {
        pageContent: "What is a sandwich?",
        metadata: { c: 1, created_at: new Date().toISOString() },
      },
      {
        pageContent: "That fence is purple.",
        metadata: { d: 1, e: 2, created_at: new Date().toISOString() },
      },
    ]);

    await waitForDocumentsIndexed(vectorStore, "Sandwich");

    const results = await vectorStore.similaritySearchWithScore(
      "Sandwich",
      1
    );

    expect(results.length).toEqual(1);
    expect(results[0]).toHaveLength(2);
    expect(results[0][0]).toMatchObject({
      pageContent: "What is a sandwich?",
      metadata: { c: 1 },
    });
    expect(typeof results[0][1]).toBe("number");
    expect(results[0][1]).toBeGreaterThan(0);
  });

  // Maximal Marginal Relevance is not yet supported with auto-embedding.
  test.skip("MongoDBAtlasVectorSearch with Maximal Marginal Relevance", async () => {
    const texts = ["foo", "foo", "foy"];
    // Auto-embed mode: no embeddings needed, collection only
    const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
      texts,
      {},
      {
        collection,
        indexName: "default",
      }
    );

    await waitForDocumentsIndexed(vectorStore, "foy");

    const output = await vectorStore.maxMarginalRelevanceSearch("foo", {
      k: 10,
      fetchK: 20,
      lambda: 0.1,
    });

    expect(output).toHaveLength(texts.length);

    const actual = output.map((doc) => doc.pageContent);
    const expected = ["foo", "foy", "foo"];
    expect(actual).toEqual(expected);

    const standardRetriever = await vectorStore.asRetriever();

    const standardRetrieverOutput =
      await standardRetriever._getRelevantDocuments("foo");
    expect(output).toHaveLength(texts.length);

    const standardRetrieverActual = standardRetrieverOutput.map(
      (doc) => doc.pageContent
    );
    const standardRetrieverExpected = ["foo", "foo", "foy"];
    expect(standardRetrieverActual).toEqual(standardRetrieverExpected);

    const retriever = await vectorStore.asRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    const retrieverOutput = await retriever._getRelevantDocuments("foo");
    expect(output).toHaveLength(texts.length);

    const retrieverActual = retrieverOutput.map((doc) => doc.pageContent);
    const retrieverExpected = ["foo", "foy", "foo"];
    expect(retrieverActual).toEqual(retrieverExpected);

    const similarity = await vectorStore.similaritySearchWithScore("foo", 1);
    expect(similarity.length).toBe(1);
  });

  test("MongoDBAtlasVectorSearch upsert", async () => {
    const vectorStore = new MongoDBAtlasVectorSearch({ collection });

    expect(vectorStore).toBeDefined();

    // check if the database is empty
    await collection.deleteMany({});

    const ids = await vectorStore.addDocuments([
      { pageContent: "Dogs are tough.", metadata: { a: 1 } },
      { pageContent: "Cats have fluff.", metadata: { b: 1 } },
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
      { pageContent: "That fence is purple.", metadata: { d: 1, e: 2 } },
    ]);

    await waitForDocumentsIndexed(vectorStore, "Sandwich");

    const results: Document[] = await vectorStore.similaritySearch(
      "Sandwich",
      1
    );

    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      { pageContent: "What is a sandwich?", metadata: { c: 1 } },
    ]);

    await vectorStore.addDocuments(
      [{ pageContent: "upserted", metadata: {} }],
      {
        ids: [ids[2]],
      }
    );

    const results2: Document[] = await vectorStore.similaritySearch(
      "Sandwich",
      1
    );

    expect(results2.length).toEqual(1);
    expect(results2[0].pageContent).not.toContain("sandwich");
  });

  describe("MongoDBAtlasVectorSearch Constructor", () => {
    test("initializes with minimal configuration", () => {
      const vectorStore = new MongoDBAtlasVectorSearch({
        collection,
      });
      expect(vectorStore).toBeDefined();
    });

    test("initializes with custom index name", () => {
      const customIndexName = "custom_index";
      const vectorStore = new MongoDBAtlasVectorSearch({
        collection,
        indexName: customIndexName,
      });
      expect(vectorStore).toBeDefined();
      // @ts-expect-error: Testing private property
      expect(vectorStore.indexName).toEqual(customIndexName);
    });

    test("initializes with custom field names", () => {
      const vectorStore = new MongoDBAtlasVectorSearch({
        collection,
        textKey: "content",
        embeddingKey: "vector",
        primaryKey: "docId",
      });
      expect(vectorStore).toBeDefined();

      // @ts-expect-error: Testing private properties
      const { textKey, embeddingKey, primaryKey } = vectorStore;
      expect(textKey).toEqual("content");
      expect(embeddingKey).toEqual("vector");
      expect(primaryKey).toEqual("docId");
    });

    test("initializes AsyncCaller with custom parameters", () => {
      const vectorStore = new MongoDBAtlasVectorSearch({
        collection,
        maxConcurrency: 5,
        maxRetries: 3,
      });
      expect(vectorStore).toBeDefined();

      const {
        // @ts-expect-error: Testing private property
        caller: { maxConcurrency, maxRetries },
      } = vectorStore;
      expect(maxConcurrency).toEqual(5);
      expect(maxRetries).toEqual(3);
    });
  });

  describe("addDocuments method", () => {
    let vectorStore: MongoDBAtlasVectorSearch;
    const documents = [
      new Document({ pageContent: "test 1" }),
      new Document({ pageContent: "test 2" }),
    ];
    beforeEach(async () => {
      vectorStore = new MongoDBAtlasVectorSearch({ collection });
    });
    test("correctly embeds and stores documents", async () => {
      await vectorStore.addDocuments(documents);

      const results = await collection
        .find({}, { projection: { _id: 0, text: 1 }, sort: { text: 1 } })
        .toArray();

      expect(results).toEqual([
        {
          text: "test 1",
        },
        {
          text: "test 2",
        },
      ]);
    });

    test("custom _ids can be provided", async () => {
      await vectorStore.addDocuments(documents, { ids: ["id1", "id2"] });

      const results = await collection
        .find({}, { projection: { text: 1 } })
        .toArray();

      expect(results).toMatchObject([
        {
          _id: "id1",
          text: "test 1",
        },
        {
          _id: "id2",
          text: "test 2",
        },
      ]);
    });

    test("documents are updated if they already exist", async () => {
      const ids = ["id1", "id2"];
      await vectorStore.addDocuments(documents, { ids });

      const updatedDocuments = [
        new Document({
          pageContent: "updated 1",
        }),
        new Document({
          pageContent: "updated 2",
        }),
      ];

      await vectorStore.addDocuments(updatedDocuments, { ids });

      // assert that no new documents were added
      expect(await collection.countDocuments({})).toBe(2);

      const results = await collection
        .find({}, { projection: { text: 1 } })
        .toArray();
      expect(results).toEqual([
        { text: "updated 1", _id: "id1" },
        { text: "updated 2", _id: "id2" },
      ]);
    });
  });

  describe("delete method", () => {
    beforeEach(async () => {
      const documents: BSONDocument[] = [
        { _id: "id1", text: "doc1" },
        { _id: "id2", text: "doc2" },
        { _id: "id3", text: "doc3" },
        { _id: "id4", text: "doc4" },
        { _id: "id5", text: "doc5" },
      ];
      await collection.insertMany(documents);
    });

    test("removes documents by ids", async () => {
      const vectorStore = new MongoDBAtlasVectorSearch({ collection });

      await vectorStore.delete({ ids: ["id1", "id3"] });

      const remaining = await collection
        .find({})
        .map(({ _id }) => _id)
        .toArray();
      expect(remaining.length).toBe(3);
      expect(remaining).toEqual(["id2", "id4", "id5"]);
    });

    test("handles large number of ids by chunking", async () => {
      // no need to use real embeddings for this test
      // since we're only testing the delete functionality
      // and not the embedding process.
      const embeddings = {
        embedDocuments: vi
          .fn<() => Promise<number[][]>>()
          .mockResolvedValue(Array(100).fill(Array(1536).fill(0.1))),
        embedQuery: vi
          .fn<() => Promise<number[][]>>()
          .mockResolvedValue(Array(1536).fill(0.1)),
      };

      let deletes = 0;
      client.on("commandStarted", (event) => {
        if (event.commandName === "delete") {
          deletes += 1;
        }
      });

      // @ts-expect-error: Mock embeddings
      const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
        collection,
      });
      const ids = Array.from({ length: 100 }, (_, i) => `id${i}`);
      await vectorStore.addDocuments(
        ids.map((id) => new Document({ pageContent: id.toString() })),
        { ids }
      );

      await vectorStore.delete({ ids });

      expect(deletes).toEqual(100 / 50); // 100 docs / chunk size
    });

    test("ignores non-existent ids", async () => {
      const vectorStore = new MongoDBAtlasVectorSearch({ collection });

      await vectorStore.delete({
        ids: ["nonexistent1", "nonexistent2", "id1"],
      });

      const remaining = await collection
        .find({})
        .map(({ _id }) => _id)
        .toArray();
      expect(remaining).toEqual(["id2", "id3", "id4", "id5"]);
    });
  });

  describe("Static Methods", () => {
    describe("fromTexts", () => {
      const texts = ["text1", "text2", "text3"];

      test("populates a vector store from strings with a metadata object", async () => {
        const metadata = { source: "test" };
        const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
          texts,
          metadata,
          { collection }
        );

        expect(vectorStore).toBeInstanceOf(MongoDBAtlasVectorSearch);

        const results = await collection
          .find({}, { projection: { text: 1, source: 1, _id: 0 } })
          .toArray();
        expect(results).toEqual([
          { text: "text1", source: "test" },
          { text: "text2", source: "test" },
          { text: "text3", source: "test" },
        ]);
      });

      test("populates a vector store from strings with an array of metadata objects", async () => {
        const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
          texts,
          [{ source: "test1" }, { source: "test2" }, { source: "test3" }],
          { collection }
        );

        expect(vectorStore).toBeInstanceOf(MongoDBAtlasVectorSearch);

        const results = await collection
          .find({}, { projection: { text: 1, source: 1, _id: 0 } })
          .toArray();
        expect(results).toEqual([
          { text: "text1", source: "test1" },
          { text: "text2", source: "test2" },
          { text: "text3", source: "test3" },
        ]);
      });
    });

    describe("fromDocuments", () => {
      test("returns an instance of MongoDBAtlasVectorSearch", async () => {
        const documents = [
          new Document({
            pageContent: "doc1",
            metadata: { source: "source1" },
          }),
        ];
        const store = await MongoDBAtlasVectorSearch.fromDocuments(documents, {
          collection,
        });
        expect(store).toBeInstanceOf(MongoDBAtlasVectorSearch);
      });

      test("embeds and inserts the provided documents", async () => {
        const documents = [
          new Document({
            pageContent: "doc1",
            metadata: { source: "source1" },
          }),
          new Document({
            pageContent: "doc2",
            metadata: { source: "source2" },
          }),
        ];

        await MongoDBAtlasVectorSearch.fromDocuments(documents, {
          collection,
        });

        const results = await collection
          .find({}, { projection: { _id: 0, text: 1 } })
          .toArray();
        expect(results.length).toBe(2);

        expect(results).toEqual([{ text: "doc1" }, { text: "doc2" }]);
      });

      test("uses custom ids if provided", async () => {
        const documents = [
          new Document({
            pageContent: "doc1",
            metadata: { source: "source1" },
          }),
          new Document({
            pageContent: "doc2",
            metadata: { source: "source2" },
          }),
        ];

        await MongoDBAtlasVectorSearch.fromDocuments(documents, {
          collection,
          ids: ["custom1", "custom2"],
        });

        const results = await collection
          .find({}, { projection: { _id: 1, text: 1 } })
          .toArray();
        expect(results.length).toBe(2);

        expect(results).toEqual([
          { text: "doc1", _id: "custom1" },
          { text: "doc2", _id: "custom2" },
        ]);
      });

      test("upserts documents if they already exist", async () => {
        await MongoDBAtlasVectorSearch.fromDocuments(
          [
            new Document({ pageContent: "doc1" }),
            new Document({ pageContent: "doc2" }),
          ],
          { collection, ids: ["id1", "id2"] }
        );

        await MongoDBAtlasVectorSearch.fromDocuments(
          [
            new Document({ pageContent: "updated 1" }),
            new Document({ pageContent: "updated 2" }),
          ],
          { collection, ids: ["id1", "id2"] }
        );

        expect(await collection.countDocuments({})).toBe(2);

        const results = await collection
          .find({}, { projection: { text: 1, _id: 0 } })
          .toArray();

        expect(results).toEqual([{ text: "updated 1" }, { text: "updated 2" }]);
      });
    });
  });
});

describe("Auto Embedding Tests without data", () => {
  let client: MongoClient;
  let collection: Collection;
  let vectorStore: MongoDBAtlasVectorSearch;

  beforeAll(async () => {
    client = new MongoClient(uri(), { monitorCommands: true });
    await client.connect();

    const namespace = "langchain_test_db.langchain_auto_embed_test";
    const [dbName, collectionName] = namespace.split(".");
    const db = client.db(dbName);

    // Drop and recreate collection to ensure clean state and no lingering indexes
    try {
      await db.dropCollection(collectionName);
    } catch {
      // Collection may not exist, which is fine
    }

    collection = await db.createCollection(collectionName);
    vectorStore = new MongoDBAtlasVectorSearch({
      collection,
    });
  });

  test("addVectors method throws error when auto embedding is enabled", async () => {
    await expect(vectorStore.addVectors([], [], {})).rejects.toThrow(
      "Cannot add vectors directly when using auto-embedding mode."
    );
  });

  test("similaritySearchVectorWithScore method throws error when auto embedding is enabled", async () => {
    const vectorStore = new MongoDBAtlasVectorSearch({
      collection,
    });
    await expect(
      vectorStore.similaritySearchVectorWithScore([], 2)
    ).rejects.toThrow(
      "Cannot perform similarity search with vectors directly when using auto-embedding mode."
    );
  });
});
