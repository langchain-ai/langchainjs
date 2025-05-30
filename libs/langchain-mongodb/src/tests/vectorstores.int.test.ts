/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { beforeAll, expect, jest, test } from "@jest/globals";
import { Collection, MongoClient } from "mongodb";
import { setTimeout } from "timers/promises";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Document as BSONDocument } from "bson";

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let collection: Collection;
beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  client = new MongoClient(uri(), { monitorCommands: true });
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

const shouldClear = true;
beforeEach(async () => {
  if (shouldClear) {
    await collection.deleteMany({});
  }
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
    const { textKey, embeddingKey, primaryKey } = vectorStore;
    expect(textKey).toEqual("content");
    expect(embeddingKey).toEqual("vector");
    expect(primaryKey).toEqual("docId");
  });

  test("initializes AsyncCaller with custom parameters", () => {
    const vectorStore = new MongoDBAtlasVectorSearch(new OpenAIEmbeddings(), {
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

describe("addVectors method", () => {
  let embeddings: OpenAIEmbeddings;
  let vectorStore: PatchedVectorStore;
  let vectors: number[][];
  const documents = [
    new Document({ pageContent: "test 1" }),
    new Document({ pageContent: "test 2" }),
  ];

  beforeEach(async () => {
    embeddings = new OpenAIEmbeddings();
    vectorStore = new PatchedVectorStore(new OpenAIEmbeddings(), {
      collection,
    });
    vectors = await embeddings.embedDocuments(["test 1", "test 2"]);
  });
  test("stores vectors and documents correctly", async () => {
    await vectorStore.addVectors(vectors, documents);

    const results = await collection
      .find({}, { projection: { _id: 0, embedding: 1, source: 1, text: 1 } })
      .toArray();
    expect(results).toEqual([
      {
        embedding: expect.any(Array),
        text: "test 1",
      },
      {
        embedding: expect.any(Array),
        text: "test 2",
      },
    ]);
  });

  test("custom _ids can be provided", async () => {
    await vectorStore.addVectors(vectors, documents, { ids: ["id1", "id2"] });

    const results = await collection
      .find({}, { projection: { text: 1 } })
      .toArray();

    expect(results).toEqual([
      { text: "test 1", _id: "id1" },
      { text: "test 2", _id: "id2" },
    ]);
  });

  test("documents are updated if they already exist", async () => {
    const ids = ["id1", "id2"];
    await vectorStore.addVectors(vectors, documents, { ids });

    const updatedDocuments = [
      new Document({
        pageContent: "updated 1",
      }),
      new Document({
        pageContent: "updated 2",
      }),
    ];

    await vectorStore.addVectors(vectors, updatedDocuments, { ids });

    // assert that no new documents were added
    expect(await collection.countDocuments({})).toBe(2);

    const updatedResults = await collection
      .find({}, { projection: { text: 1 } })
      .toArray();

    expect(updatedResults).toEqual([
      { text: "updated 1", _id: "id1" },
      { text: "updated 2", _id: "id2" },
    ]);
  });

  test("throws error when ids length doesn't match vectors length", async () => {
    await expect(
      vectorStore.addVectors(vectors, documents, { ids: ["id1"] })
    ).rejects.toThrow(
      'If provided, "options.ids" must be an array with the same length as "vectors".'
    );
  });
});

describe("addDocuments method", () => {
  let embeddings: OpenAIEmbeddings;
  let vectorStore: PatchedVectorStore;
  const documents = [
    new Document({ pageContent: "test 1" }),
    new Document({ pageContent: "test 2" }),
  ];
  beforeEach(async () => {
    embeddings = new OpenAIEmbeddings();
    vectorStore = new PatchedVectorStore(embeddings, {
      collection,
    });
  });
  test("correctly embeds and stores documents", async () => {
    const spy = jest.spyOn(embeddings, "embedDocuments");
    await vectorStore.addDocuments(documents);

    const results = await collection
      .find(
        {},
        { projection: { _id: 0, embedding: 1, text: 1 }, sort: { text: 1 } }
      )
      .toArray();

    expect(spy).toHaveBeenCalledWith(["test 1", "test 2"]);
    expect(results).toEqual([
      {
        embedding: expect.any(Array),
        text: "test 1",
      },
      {
        embedding: expect.any(Array),
        text: "test 2",
      },
    ]);
  });

  test("custom _ids can be provided", async () => {
    await vectorStore.addDocuments(documents, { ids: ["id1", "id2"] });

    const results = await collection
      .find({}, { projection: { embedding: 1, text: 1 } })
      .toArray();

    expect(results).toMatchObject([
      {
        _id: "id1",
        embedding: expect.any(Array),
        text: "test 1",
      },
      {
        _id: "id2",
        embedding: expect.any(Array),
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
      .find({}, { projection: { text: 1, embedding: 1 } })
      .toArray();
    expect(results).toEqual([
      { text: "updated 1", _id: "id1", embedding: expect.any(Array) },
      { text: "updated 2", _id: "id2", embedding: expect.any(Array) },
    ]);
  });
});

describe("similaritySearchVectorWithScore method", () => {
  let embeddings: OpenAIEmbeddings;
  let vectorStore: PatchedVectorStore;
  beforeEach(async () => {
    embeddings = new OpenAIEmbeddings();
    vectorStore = new PatchedVectorStore(embeddings, {
      collection,
    });

    await collection.deleteMany({});

    const documents = [
      new Document({ pageContent: "cat", metadata: { a: 1, id: 1 } }),
      new Document({ pageContent: "dog", metadata: { a: 1, b: 2, id: 2 } }),
      new Document({
        pageContent: "fish",
        metadata: { c: 3, id: 3 },
      }),
      new Document({ pageContent: "car", metadata: { e: 4, id: 4 } }),
    ];

    await vectorStore.addDocuments(documents);
  });

  test("returns correct documents and scores", async () => {
    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("cat"),
      2
    );

    expect(results.length).toBe(2);
    // TODO - figure out how to test the score
    const [[doc1], [doc2]] = results;
    expect(doc1.pageContent).toBe("cat");
    expect(doc2.pageContent).toBe("dog");
  });

  test("with preFilter applies filters correctly", async () => {
    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("car"),
      2,
      { preFilter: { e: { $eq: 4 } } }
    );

    // even though we specify k=2, we only get one result because of the prefilter.
    expect(results.length).toBe(1);
    const [[doc1]] = results;
    expect(doc1.pageContent).toBe("car");
  });

  test("when specified, a postFilterPipeline filters out unspecified documents", async () => {
    const results = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("cat"),
      2,
      {
        postFilterPipeline: [{ $match: { "metadata.nonExistentField": true } }],
      }
    );

    expect(results).toHaveLength(0);
  });

  test("embeddings are excluded by default", async () => {
    const [[{ metadata }]] = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("cat"),
      2
    );

    expect(metadata).not.toHaveProperty("embedding");
  });

  test("embeddings are included when includeEmbeddings=true", async () => {
    const [[{ metadata }]] = await vectorStore.similaritySearchVectorWithScore(
      await embeddings.embedQuery("cat"),
      2,
      { includeEmbeddings: true }
    );

    expect(metadata).toHaveProperty("embedding");
  });
});

describe("maxMarginalRelevanceSearch method", () => {
  // The tests in this suite mock the embeddings to return a consistent set of vectors.
  // This is necessary because the actual embedding process is not deterministic (can change
  // with different models) and we want to ensure the tests are stable and predictable.

  const embeddings = {
    embedQuery: async () => [[0.5, 0.5, 0.5]],
  };

  const sources = [
    [1, 1, 1],
    [0.9, 0.9, 0.9],
    [0.8, 0.8, 0.8],
    [0.7, 0.7, 0.7],
    [0.6, 0.6, 0.6],
    [0.5, 0.5, 0.5],
    [0.4, 0.4, 0.4],
    [0.3, 0.3, 0.3],
    [0.2, 0.2, 0.2],
    [0.1, 0.1, 0.1],
  ];

  const documents = sources.map(
    (source, index) =>
      new Document({
        pageContent: `doc${index + 1}`,
        metadata: { embedding: source },
      })
  );

  let vectorStore: PatchedVectorStore;

  let spy: jest.SpiedFunction<
    (
      query: number[],
      k: number,
      filter: Record<string, unknown>
    ) => Promise<[Document<Record<string, unknown>>, number][]>
  >;

  beforeEach(() => {
    vectorStore = new PatchedVectorStore(
      embeddings as unknown as OpenAIEmbeddings,
      {
        collection,
      }
    );

    spy = jest
      .spyOn(vectorStore, "similaritySearchVectorWithScore")
      .mockImplementation(async () =>
        documents.map((doc) => {
          // the similarity score is not used by the maxMarginalRelevanceSearch, so
          // use a dummy value of 0.
          const docWithSimilarity = [doc, 0] as [Document, number];
          return docWithSimilarity;
        })
      );
  });

  test("returns k results", async () => {
    const results = await vectorStore.maxMarginalRelevanceSearch("query", {
      k: 2,
      fetchK: 10,
      lambda: 0,
      filter: { includeEmbeddings: true },
    });
    expect(results).toHaveLength(2);
    expect(results.map((doc) => doc.metadata.embedding)).toEqual(
      expect.arrayContaining([
        [1, 1, 1],
        [0.6, 0.6, 0.6],
      ])
    );
  });

  test("a high lambda yields documents with high diversity", async () => {
    const results = await vectorStore.maxMarginalRelevanceSearch("query", {
      k: 3,
      fetchK: 10,
      lambda: 0,
      filter: { includeEmbeddings: true },
    });
    expect(results).toHaveLength(3);
    expect(results.map((doc) => doc.metadata.embedding)).toEqual(
      expect.arrayContaining([
        [1, 1, 1],
        [0.6, 0.6, 0.6],
        [0.3, 0.3, 0.3],
      ])
    );
  });

  test("a low lambda yields documents with high diversity", async () => {
    const results = await vectorStore.maxMarginalRelevanceSearch("query", {
      k: 3,
      fetchK: 10,
      lambda: 1,
      filter: { includeEmbeddings: true },
    });
    expect(results).toHaveLength(3);
    expect(results.map((doc) => doc.metadata.embedding)).toEqual(
      expect.arrayContaining([
        [1, 1, 1],
        [0.9, 0.9, 0.9],
      ])
    );
  });

  test("with fetchK parameter retrieves correct number of candidates", async () => {
    const results = await vectorStore.maxMarginalRelevanceSearch("query", {
      k: 3,
      fetchK: 5,
      lambda: 0.5,
      filter: { includeEmbeddings: true },
    });
    expect(results).toHaveLength(3);
    const [[_, k, __]] = spy.mock.calls;
    expect(k).toBe(5);
  });

  test("with filter correctly applies filtering", async () => {
    const results = await vectorStore.maxMarginalRelevanceSearch("query", {
      k: 3,
      fetchK: 10,
      lambda: 0.5,
      filter: {
        includeEmbeddings: true,
        preFilter: { "metadata.embedding": { $gte: [0.5, 0.5, 0.5] } },
      },
    });
    expect(results).toHaveLength(3);
    const [[_, __, filter]] = spy.mock.calls;
    expect(filter.preFilter).toEqual({
      "metadata.embedding": { $gte: [0.5, 0.5, 0.5] },
    });
  });

  test("does not return embeddings by default", async () => {
    const results = await vectorStore.maxMarginalRelevanceSearch("query", {
      k: 3,
      fetchK: 10,
      lambda: 0.5,
    });
    expect(results).toHaveLength(3);
    expect(results[0].metadata).not.toHaveProperty("embedding");
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
    // no need to use real embeddings for this test
    // since we're only testing the delete functionality
    // and not the embedding process.
    const embeddings = {
      embedDocuments: jest
        .fn<() => Promise<number[][]>>()
        .mockResolvedValue(Array(100).fill(Array(1536).fill(0.1))),
      embedQuery: jest
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
    const vectorStore = new PatchedVectorStore(embeddings, {
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
    let embeddings: OpenAIEmbeddings;
    const texts = ["text1", "text2", "text3"];
    beforeEach(() => {
      embeddings = new OpenAIEmbeddings();
    });

    test("populates a vector store from strings with a metadata object", async () => {
      const metadata = { source: "test" };
      const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
        texts,
        metadata,
        embeddings,
        { collection }
      );

      expect(vectorStore).toBeInstanceOf(MongoDBAtlasVectorSearch);

      const results = await collection
        .find({}, { projection: { text: 1, source: 1, _id: 0, embedding: 1 } })
        .toArray();
      expect(results).toEqual([
        { text: "text1", source: "test", embedding: expect.any(Array) },
        { text: "text2", source: "test", embedding: expect.any(Array) },
        { text: "text3", source: "test", embedding: expect.any(Array) },
      ]);
    });

    test("populates a vector store from strings with an array of metadata objects", async () => {
      const vectorStore = await MongoDBAtlasVectorSearch.fromTexts(
        texts,
        [{ source: "test1" }, { source: "test2" }, { source: "test3" }],
        embeddings,
        { collection }
      );

      expect(vectorStore).toBeInstanceOf(MongoDBAtlasVectorSearch);

      const results = await collection
        .find({}, { projection: { text: 1, source: 1, _id: 0, embedding: 1 } })
        .toArray();
      expect(results).toEqual([
        { text: "text1", source: "test1", embedding: expect.any(Array) },
        { text: "text2", source: "test2", embedding: expect.any(Array) },
        { text: "text3", source: "test3", embedding: expect.any(Array) },
      ]);
    });
  });

  describe("fromDocuments", () => {
    test("returns an instance of MongoDBAtlasVectorSearch", async () => {
      const documents = [
        new Document({ pageContent: "doc1", metadata: { source: "source1" } }),
      ];
      const store = await MongoDBAtlasVectorSearch.fromDocuments(
        documents,
        new OpenAIEmbeddings(),
        { collection }
      );
      expect(store).toBeInstanceOf(MongoDBAtlasVectorSearch);
    });

    test("embeds and inserts the provided documents", async () => {
      const documents = [
        new Document({ pageContent: "doc1", metadata: { source: "source1" } }),
        new Document({ pageContent: "doc2", metadata: { source: "source2" } }),
      ];

      await MongoDBAtlasVectorSearch.fromDocuments(
        documents,
        new OpenAIEmbeddings(),
        { collection }
      );

      const results = await collection
        .find({}, { projection: { _id: 0, text: 1, embedding: 1 } })
        .toArray();
      expect(results.length).toBe(2);

      expect(results).toEqual([
        { text: "doc1", embedding: expect.any(Array) },
        { text: "doc2", embedding: expect.any(Array) },
      ]);
    });

    test("uses custom ids if provided", async () => {
      const documents = [
        new Document({ pageContent: "doc1", metadata: { source: "source1" } }),
        new Document({ pageContent: "doc2", metadata: { source: "source2" } }),
      ];

      await MongoDBAtlasVectorSearch.fromDocuments(
        documents,
        new OpenAIEmbeddings(),
        { collection, ids: ["custom1", "custom2"] }
      );

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
        new OpenAIEmbeddings(),
        { collection, ids: ["id1", "id2"] }
      );

      await MongoDBAtlasVectorSearch.fromDocuments(
        [
          new Document({ pageContent: "updated 1" }),
          new Document({ pageContent: "updated 2" }),
        ],
        new OpenAIEmbeddings(),
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
