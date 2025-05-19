/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { expect, jest, test } from "@jest/globals";
import { Collection, MongoClient } from "mongodb";
import { setTimeout } from "timers/promises";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { MongoDBAtlasVectorSearch } from "../vectorstores.js";
import { isUsingLocalAtlas, uri, waitForIndexToBeQueryable } from "./utils.js";

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

let client: MongoClient;
let collection: Collection;
beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  client = new MongoClient(uri());
  await client.connect();

  const namespace = "langchain.test";
  const [dbName, collectionName] = namespace.split(".");
  collection = await client.db(dbName).createCollection(collectionName);

  if (!isUsingLocalAtlas()) return;

  await collection.createSearchIndex({
    name: "default",
    type: "search",
    definition: {
      mappings: {
        fields: {
          e: { type: "number" },
          embedding: {
            dimensions: 1536,
            similarity: "euclidean",
            type: "knnVector",
          },
        },
      },
    },
  });

  await waitForIndexToBeQueryable(collection, "default");
});

beforeEach(async () => {
  await collection.deleteMany({});
});

afterAll(async () => {
  if (isUsingLocalAtlas()) {
    await collection.dropSearchIndex("default");
  }
  await client.close();
});

/** adapted from langchain's python implementation
 * see https://github.com/langchain-ai/langchain-mongodb/blob/6ae485fd576a26c882ebe277b66628ddbb440545/libs/langchain-mongodb/tests/utils.py#L54
 *
 * When a search index is created, all documents are indexed before the collection is queryable
 * with $vectorSearch.  However, when documents are added to a collection with an existing index,
 * the writes will return before the search index is updated.  This class patches the `addDocuments()`
 * method to wait until queries return the expected number of results before returning.
 */
class PatchedVectorStore extends MongoDBAtlasVectorSearch {
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    const docs = await super.addDocuments(documents, options);
    for (;;) {
      const results = await this.similaritySearch("sandwich", documents.length);
      if (results.length === documents.length) {
        return docs;
      }
      await setTimeout(1000);
    }
  }
}

test("MongoDBAtlasVectorSearch with external ids", async () => {
  const vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
    collection,
  });

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

  const results: Document[] = await vectorStore.similaritySearch("Sandwich", 1);

  expect(results.length).toEqual(1);
  expect(results).toMatchObject([
    { pageContent: "What is a sandwich?", metadata: { c: 1 } },
  ]);

  // // we can pre filter the search
  // const preFilter = {
  //   e: { $lte: 1 },
  // };

  // const filteredResults = await vectorStore.similaritySearch(
  //   "That fence is purple",
  //   1,
  //   preFilter
  // );

  // expect(filteredResults).toEqual([]);

  // const retriever = vectorStore.asRetriever({
  //   filter: {
  //     preFilter,
  //   },
  // });

  // const docs = await retriever.getRelevantDocuments("That fence is purple");
  // expect(docs).toEqual([]);
});

test("MongoDBAtlasVectorSearch with Maximal Marginal Relevance", async () => {
  const texts = ["foo", "foo", "foy"];
  const vectorStore = await PatchedVectorStore.fromTexts(
    texts,
    {},
    new OpenAIEmbeddings(),
    { collection, indexName: "default" }
  );

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

  const standardRetrieverOutput = await standardRetriever.getRelevantDocuments(
    "foo"
  );
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

  const retrieverOutput = await retriever.getRelevantDocuments("foo");
  expect(output).toHaveLength(texts.length);

  const retrieverActual = retrieverOutput.map((doc) => doc.pageContent);
  const retrieverExpected = ["foo", "foy", "foo"];
  expect(retrieverActual).toEqual(retrieverExpected);

  const similarity = await vectorStore.similaritySearchWithScore("foo", 1);
  expect(similarity.length).toBe(1);
});

test("MongoDBAtlasVectorSearch upsert", async () => {
  const vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
    collection,
  });

  expect(vectorStore).toBeDefined();

  // check if the database is empty
  await collection.deleteMany({});

  const ids = await vectorStore.addDocuments([
    { pageContent: "Dogs are tough.", metadata: { a: 1 } },
    { pageContent: "Cats have fluff.", metadata: { b: 1 } },
    { pageContent: "What is a sandwich?", metadata: { c: 1 } },
    { pageContent: "That fence is purple.", metadata: { d: 1, e: 2 } },
  ]);

  const results: Document[] = await vectorStore.similaritySearch("Sandwich", 1);

  expect(results.length).toEqual(1);
  expect(results).toMatchObject([
    { pageContent: "What is a sandwich?", metadata: { c: 1 } },
  ]);

  await vectorStore.addDocuments([{ pageContent: "upserted", metadata: {} }], {
    ids: [ids[2]],
  });

  const results2: Document[] = await vectorStore.similaritySearch(
    "Sandwich",
    1
  );

  expect(results2.length).toEqual(1);
  expect(results2[0].pageContent).not.toContain("sandwich");
});

// Setup and teardown code would be here

describe("MongoDBAtlasVectorSearch Constructor", () => {
  test("initializes with minimal configuration", () => {
    const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
      collection,
    });
    expect(vectorStore).toBeDefined();
  });

  test("initializes with custom index name", () => {
    const customIndexName = "custom_index";
    const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
      collection,
      indexName: customIndexName,
    });
    expect(vectorStore).toBeDefined();
    // @ts-expect-error: Testing private property
    expect(vectorStore.indexName).toEqual(customIndexName);
  });

  test("initializes with custom field names", () => {
    const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
      collection,
      textKey: "content",
      embeddingKey: "vector",
      primaryKey: "docId",
    });
    expect(vectorStore).toBeDefined();
    // @ts-expect-error: Testing private properties
    expect(vectorStore.textKey).toEqual("content");
    // @ts-expect-error: Testing private properties
    expect(vectorStore.embeddingKey).toEqual("vector");
    // @ts-expect-error: Testing private properties
    expect(vectorStore.primaryKey).toEqual("docId");
  });

  test("initializes AsyncCaller with custom parameters", () => {
    const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
      collection,
      maxConcurrency: 5,
      maxRetries: 3,
    });
    expect(vectorStore).toBeDefined();
    // @ts-expect-error: Testing private property
    expect(vectorStore.caller.maxConcurrency).toEqual(5);
    // @ts-expect-error: Testing private property
    expect(vectorStore.caller.maxRetries).toEqual(3);
  });
});

describe("addVectors method", () => {
  test("stores vectors and documents correctly", async () => {
    const vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
      collection,
    });

    await collection.deleteMany({});

    const vectors = [Array(1536).fill(0.1), Array(1536).fill(0.2)];
    const documents = [
      new Document({ pageContent: "test 1", metadata: { source: "source1" } }),
      new Document({ pageContent: "test 2", metadata: { source: "source2" } }),
    ];

    await vectorStore.addVectors(vectors, documents);

    const results = await collection.find({}).toArray();
    expect(results.length).toBe(2);
    expect(results[0].text).toBe("test 1");
    expect(results[0].embedding).toEqual(Array(1536).fill(0.1));
    expect(results[0].source).toBe("source1");
    expect(results[1].text).toBe("test 2");
    expect(results[1].embedding).toEqual(Array(1536).fill(0.2));
    expect(results[1].source).toBe("source2");
  });

  test("with custom ids performs upsert correctly", async () => {
    const vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
      collection,
    });

    await collection.deleteMany({});

    const vectors = [Array(1536).fill(0.1), Array(1536).fill(0.2)];
    const documents = [
      new Document({ pageContent: "test 1", metadata: { source: "source1" } }),
      new Document({ pageContent: "test 2", metadata: { source: "source2" } }),
    ];
    const ids = ["id1", "id2"];

    await vectorStore.addVectors(vectors, documents, { ids });

    // Check if documents were inserted
    const results = await collection.find({}).toArray();
    expect(results.length).toBe(2);
    expect(results.find((r) => r._id === "id1")).toBeDefined();
    expect(results.find((r) => r._id === "id2")).toBeDefined();

    // Test upsert with updated data
    const updatedVectors = [Array(1536).fill(0.3), Array(1536).fill(0.4)];
    const updatedDocuments = [
      new Document({
        pageContent: "updated 1",
        metadata: { source: "updated1" },
      }),
      new Document({
        pageContent: "updated 2",
        metadata: { source: "updated2" },
      }),
    ];

    await vectorStore.addVectors(updatedVectors, updatedDocuments, { ids });

    const updatedResults = await collection.find({}).toArray();
    expect(updatedResults.length).toBe(2);
    const doc1 = updatedResults.find((r) => r._id === "id1");
    const doc2 = updatedResults.find((r) => r._id === "id2");

    expect(doc1.text).toBe("updated 1");
    expect(doc1.embedding).toEqual(Array(1536).fill(0.3));
    expect(doc1.source).toBe("updated1");
    expect(doc2.text).toBe("updated 2");
    expect(doc2.embedding).toEqual(Array(1536).fill(0.4));
    expect(doc2.source).toBe("updated2");
  });

  test("throws error when ids length doesn't match vectors length", async () => {
    const vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
      collection,
    });

    const vectors = [Array(1536).fill(0.1), Array(1536).fill(0.2)];
    const documents = [
      new Document({ pageContent: "test 1", metadata: {} }),
      new Document({ pageContent: "test 2", metadata: {} }),
    ];
    const ids = ["id1"]; // Only one ID for two vectors

    await expect(
      vectorStore.addVectors(vectors, documents, { ids })
    ).rejects.toThrow(
      'If provided, "options.ids" must be an array with the same length as "vectors".'
    );
  });
});

describe("addDocuments method", () => {
  test("correctly embeds and stores documents", async () => {
    const embeddings = {
      embedDocuments: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue([Array(1536).fill(0.1), Array(1536).fill(0.2)]),
      embedQuery: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue(Array(1536).fill(0.1)),
    };

    // @ts-expect-error: Mock embeddings
    const vectorStore = new PatchedVectorStore(embeddings, {
      collection,
    });

    await collection.deleteMany({});

    const documents = [
      new Document({ pageContent: "test 1", metadata: { source: "source1" } }),
      new Document({ pageContent: "test 2", metadata: { source: "source2" } }),
    ];

    await vectorStore.addDocuments(documents);

    expect(embeddings.embedDocuments).toHaveBeenCalledWith([
      "test 1",
      "test 2",
    ]);

    const results = await collection.find({}).toArray();
    expect(results.length).toBe(2);
    expect(results[0].text).toBe("test 1");
    expect(results[0].embedding).toEqual(Array(1536).fill(0.1));
    expect(results[1].text).toBe("test 2");
    expect(results[1].embedding).toEqual(Array(1536).fill(0.2));
  });

  test("with custom ids performs upsert correctly", async () => {
    const embeddings = {
      embedDocuments: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue([Array(1536).fill(0.1), Array(1536).fill(0.2)]),
      embedQuery: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue(Array(1536).fill(0.1)),
    };

    // @ts-expect-error: Mock embeddings
    const vectorStore = new PatchedVectorStore(embeddings, {
      collection,
    });

    await collection.deleteMany({});

    const documents = [
      new Document({ pageContent: "test 1", metadata: { source: "source1" } }),
      new Document({ pageContent: "test 2", metadata: { source: "source2" } }),
    ];

    await vectorStore.addDocuments(documents, { ids: ["id1", "id2"] });

    const results = await collection.find({}).toArray();
    expect(results.length).toBe(2);
    expect(results.find((r) => r._id === "id1")).toBeDefined();
    expect(results.find((r) => r._id === "id2")).toBeDefined();
  });

  test("correctly handles documents with special characters", async () => {
    const embeddings = {
      embedDocuments: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue([Array(1536).fill(0.1)]),
      embedQuery: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue(Array(1536).fill(0.1)),
    };

    // @ts-expect-error: Mock embeddings
    const vectorStore = new PatchedVectorStore(embeddings, {
      collection,
    });

    await collection.deleteMany({});

    const documents = [
      new Document({
        pageContent: "test !@#$%^&*()",
        metadata: { source: "special" },
      }),
    ];

    await vectorStore.addDocuments(documents);

    const results = await collection.find({}).toArray();
    expect(results.length).toBe(1);
    expect(results[0].text).toBe("test !@#$%^&*()");
    expect(results[0].embedding).toEqual(Array(1536).fill(0.1));
    expect(results[0].source).toBe("special");
  });
});

describe("similaritySearchVectorWithScore method", () => {
  beforeEach(async () => {
    const embeddings = {
      embedDocuments: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue([
          Array(1536).fill(0.1),
          Array(1536).fill(0.2),
          Array(1536).fill(0.3),
          Array(1536).fill(0.4),
        ]),
      embedQuery: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue(Array(1536).fill(0.1)),
    };

    // @ts-expect-error: Mock embeddings
    const vectorStore = new PatchedVectorStore(embeddings, {
      collection,
    });

    await collection.deleteMany({});

    const documents = [
      new Document({ pageContent: "cat", metadata: { animal: true, id: 1 } }),
      new Document({ pageContent: "dog", metadata: { animal: true, id: 2 } }),
      new Document({
        pageContent: "fish",
        metadata: { animal: true, id: 3, aquatic: true },
      }),
      new Document({ pageContent: "car", metadata: { vehicle: true, id: 4 } }),
    ];

    await vectorStore.addDocuments(documents);
  });

  test("returns correct documents and scores", async () => {
    // Test basic similarity search with scores
  });

  test("with preFilter applies filters correctly", async () => {
    // Test preFilter functionality
  });

  test("with postFilterPipeline applies pipeline correctly", async () => {
    // Test postFilterPipeline functionality
  });

  test("with includeEmbeddings returns embeddings", async () => {
    // Test includeEmbeddings functionality
  });

  test("handles complex combined filters", async () => {
    // Test combination of filter types
  });
});

describe("maxMarginalRelevanceSearch method", () => {
  let embeddings: {
    embedQuery: jest.Mock<() => Promise<number[][]>>;
    embedDocuments: jest.Mock;
  };

  beforeEach(() => {
    // Mock embeddings with controlled values for deterministic MMR testing
    embeddings = {
      embedQuery: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue(Array(1536).fill(0.1)),
      embedDocuments: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue([
          Array(1536).fill(0.1),
          Array(1536).fill(0.2),
          Array(1536).fill(0.3),
        ]),
    };
  });

  test("returns diverse results", async () => {
    // Test basic MMR functionality
  });

  test("with different lambda values affects diversity", async () => {
    // Test impact of lambda parameter
  });

  test("with fetchK parameter retrieves correct number of candidates", async () => {
    // Test fetchK parameter
  });

  test("with filter correctly applies filtering", async () => {
    // Test filtered MMR search
  });

  test("respects includeEmbeddings flag", async () => {
    // Test that embeddings are included/excluded based on flag
  });
});

describe("delete method", () => {
  beforeEach(async () => {
    // Setup test data
    await collection.deleteMany({});
    await collection.insertMany([
      { _id: "id1", text: "doc1" },
      { _id: "id2", text: "doc2" },
      { _id: "id3", text: "doc3" },
      { _id: "id4", text: "doc4" },
      { _id: "id5", text: "doc5" },
    ]);
  });

  test("removes documents by ids", async () => {
    const vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
      collection,
    });

    await vectorStore.delete({ ids: ["id1", "id3"] });

    const remaining = await collection
      .find({})
      .map(({ _id }) => _id)
      .toArray();
    expect(remaining.length).toBe(3);
    expect(remaining).toEqual(["id2", "id4", "id5"]);
  });

  test("handles large number of ids by chunking", async () => {
    // Test chunking for large deletions
  });

  test("ignores non-existent ids", async () => {
    const vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
      collection,
    });

    await vectorStore.delete({ ids: ["nonexistent1", "nonexistent2", "id1"] });

    const remaining = await collection
      .find({})
      .map(({ _id }) => _id)
      .toArray();
    expect(remaining).toEqual(["id2", "id3", "id4", "id5"]);
  });
});

describe("Static Methods", () => {
  describe("fromTexts", () => {
    test("creates instance with correct documents from strings", async () => {
      // Test fromTexts factory method
    });

    test("with array of metadata assigns correct metadata to each document", async () => {
      // Test metadata handling in fromTexts
    });

    test("with single metadata object applies to all documents", async () => {
      // Test single metadata object behavior
    });
  });

  describe("fromDocuments", () => {
    test("creates instance with documents preserved", async () => {
      // Test fromDocuments factory method
    });

    test("with custom ids performs upsert behavior", async () => {
      // Test fromDocuments with custom ids
    });
  });
});
