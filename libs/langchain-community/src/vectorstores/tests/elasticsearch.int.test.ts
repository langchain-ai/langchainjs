import { test, expect } from "@jest/globals";
import { Client, ClientOptions } from "@elastic/elasticsearch";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import {
  ElasticVectorSearch,
  HybridRetrievalStrategy,
} from "../elasticsearch.js";

describe("ElasticVectorSearch", () => {
  let store: ElasticVectorSearch;

  beforeEach(async () => {
    if (!process.env.ELASTIC_URL) {
      throw new Error("ELASTIC_URL not set");
    }

    const config: ClientOptions = {
      node: process.env.ELASTIC_URL,
    };
    if (process.env.ELASTIC_API_KEY) {
      config.auth = {
        apiKey: process.env.ELASTIC_API_KEY,
      };
    } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
      config.auth = {
        username: process.env.ELASTIC_USERNAME,
        password: process.env.ELASTIC_PASSWORD,
      };
    }
    const client = new Client(config);

    const indexName = "test_index";

    const embeddings = new OpenAIEmbeddings();
    store = new ElasticVectorSearch(embeddings, { client, indexName });
    await store.deleteIfExists();

    expect(store).toBeDefined();
  });

  test.skip("ElasticVectorSearch integration", async () => {
    const createdAt = new Date().getTime();

    const ids = await store.addDocuments([
      { pageContent: "hello", metadata: { a: createdAt + 1 } },
      { pageContent: "car", metadata: { a: createdAt } },
      { pageContent: "adjective", metadata: { a: createdAt } },
      { pageContent: "hi", metadata: { a: createdAt } },
    ]);

    const results1 = await store.similaritySearch("hello!", 1);

    expect(results1).toHaveLength(1);
    expect(results1).toEqual([
      new Document({ metadata: { a: createdAt + 1 }, pageContent: "hello" }),
    ]);

    const results2 = await store.similaritySearchWithScore("testing!", 6, {
      a: createdAt,
    });

    expect(results2).toHaveLength(3);

    const ids2 = await store.addDocuments(
      [
        { pageContent: "hello upserted", metadata: { a: createdAt + 1 } },
        { pageContent: "car upserted", metadata: { a: createdAt } },
        { pageContent: "adjective upserted", metadata: { a: createdAt } },
        { pageContent: "hi upserted", metadata: { a: createdAt } },
      ],
      { ids }
    );

    expect(ids).toEqual(ids2);

    const results3 = await store.similaritySearchWithScore("testing!", 6, {
      a: createdAt,
    });

    expect(results3).toHaveLength(3);

    // console.log(`Upserted:`, results3);

    await store.delete({ ids: ids.slice(2) });

    const results4 = await store.similaritySearchWithScore("testing!", 3, {
      a: createdAt,
    });

    expect(results4).toHaveLength(1);
  });

  test.skip("ElasticVectorSearch integration with more than 10 documents", async () => {
    const createdAt = new Date().getTime();
    await store.addDocuments([
      { pageContent: "pretty", metadata: { a: createdAt + 1 } },
      { pageContent: "intelligent", metadata: { a: createdAt } },
      { pageContent: "creative", metadata: { a: createdAt } },
      { pageContent: "courageous", metadata: { a: createdAt } },
      { pageContent: "energetic", metadata: { a: createdAt } },
      { pageContent: "patient", metadata: { a: createdAt } },
      { pageContent: "responsible", metadata: { a: createdAt } },
      { pageContent: "friendly", metadata: { a: createdAt } },
      { pageContent: "confident", metadata: { a: createdAt } },
      { pageContent: "generous", metadata: { a: null } },
      { pageContent: "compassionate", metadata: {} },
    ]);
    const results = await store.similaritySearch("*", 11);
    expect(results).toHaveLength(11);
    const results2 = await store.similaritySearch("*", 11, [
      {
        field: "a",
        value: createdAt,
        operator: "exclude",
      },
    ]);
    expect(results2).toHaveLength(3);
    const results3 = await store.similaritySearch("*", 11, [
      {
        field: "a",
        value: [createdAt],
        operator: "exclude",
      },
    ]);
    expect(results3).toHaveLength(3);
    const results4 = await store.similaritySearch("*", 11, [
      {
        field: "a",
        operator: "not_exists",
      },
    ]);
    expect(results4).toHaveLength(2);
  });

  test.skip("ElasticVectorSearch integration with text splitting metadata", async () => {
    const createdAt = new Date().getTime();
    const documents = [
      new Document({
        pageContent: "hello",
        metadata: { a: createdAt, loc: { lines: { from: 1, to: 1 } } },
      }),
      new Document({
        pageContent: "car",
        metadata: { a: createdAt, loc: { lines: { from: 2, to: 2 } } },
      }),
    ];

    await store.addDocuments(documents);

    const results1 = await store.similaritySearch("hello!", 1);

    expect(results1).toHaveLength(1);
    expect(results1).toEqual([
      new Document({
        metadata: { a: createdAt, loc: { lines: { from: 1, to: 1 } } },
        pageContent: "hello",
      }),
    ]);
  });
});

describe("ElasticVectorSearch - Backward Compatibility", () => {
  let client: Client;
  let embeddings: OpenAIEmbeddings;

  beforeEach(() => {
    if (!process.env.ELASTIC_URL) {
      throw new Error("ELASTIC_URL not set");
    }

    const config: ClientOptions = {
      node: process.env.ELASTIC_URL,
    };
    if (process.env.ELASTIC_API_KEY) {
      config.auth = {
        apiKey: process.env.ELASTIC_API_KEY,
      };
    } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
      config.auth = {
        username: process.env.ELASTIC_USERNAME,
        password: process.env.ELASTIC_PASSWORD,
      };
    }
    client = new Client(config);
    embeddings = new OpenAIEmbeddings();
  });

  test.skip("Pure vector search without strategy works unchanged", async () => {
    const indexName = "test_backward_compat_pure";
    const store = new ElasticVectorSearch(embeddings, { client, indexName });
    await store.deleteIfExists();

    await store.addDocuments([
      new Document({ pageContent: "hello world" }),
      new Document({ pageContent: "goodbye world" }),
      new Document({ pageContent: "hello universe" }),
    ]);

    const results = await store.similaritySearch("hello", 2);

    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Document);
    expect(results[0].pageContent).toContain("hello");
  });

  test.skip("similaritySearchVectorWithScore works without strategy", async () => {
    const indexName = "test_backward_compat_scores";
    const store = new ElasticVectorSearch(embeddings, { client, indexName });
    await store.deleteIfExists();

    const createdAt = new Date().getTime();
    await store.addDocuments([
      new Document({
        pageContent: "vector search",
        metadata: { a: createdAt },
      }),
      new Document({
        pageContent: "semantic search",
        metadata: { a: createdAt },
      }),
      new Document({
        pageContent: "keyword search",
        metadata: { a: createdAt + 1 },
      }),
    ]);

    const queryVector = await embeddings.embedQuery("vector");
    const results = await store.similaritySearchVectorWithScore(
      queryVector,
      2,
      { a: createdAt }
    );

    expect(results).toHaveLength(2);
    results.forEach(([doc, score]) => {
      expect(doc).toBeInstanceOf(Document);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThan(0);
      expect(doc.metadata.a).toBe(createdAt);
    });
  });

  test.skip("fromTexts static method works without strategy", async () => {
    const indexName = "test_backward_compat_fromtexts";

    const store = await ElasticVectorSearch.fromTexts(
      ["first document", "second document", "third document"],
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      embeddings,
      { client, indexName }
    );

    await store.deleteIfExists();

    const newStore = await ElasticVectorSearch.fromTexts(
      ["first document", "second document", "third document"],
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      embeddings,
      { client, indexName }
    );

    const results = await newStore.similaritySearch("first", 1);

    expect(results).toHaveLength(1);
    expect(results[0]).toBeInstanceOf(Document);
    expect(results[0].pageContent).toBe("first document");
    expect(results[0].metadata.id).toBe(1);
  });
});

describe("ElasticVectorSearch - Hybrid Search", () => {
  let client: Client;
  let embeddings: OpenAIEmbeddings;

  beforeEach(() => {
    if (!process.env.ELASTIC_URL) {
      throw new Error("ELASTIC_URL not set");
    }

    const config: ClientOptions = {
      node: process.env.ELASTIC_URL,
    };
    if (process.env.ELASTIC_API_KEY) {
      config.auth = {
        apiKey: process.env.ELASTIC_API_KEY,
      };
    } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
      config.auth = {
        username: process.env.ELASTIC_USERNAME,
        password: process.env.ELASTIC_PASSWORD,
      };
    }
    client = new Client(config);
    embeddings = new OpenAIEmbeddings();
  });

  test.skip("Hybrid search with default strategy", async () => {
    const indexName = "test_hybrid_default";
    const store = new ElasticVectorSearch(embeddings, {
      client,
      indexName,
      strategy: new HybridRetrievalStrategy(),
    });
    await store.deleteIfExists();

    await store.addDocuments([
      new Document({
        pageContent: "The quick brown fox jumps over the lazy dog",
      }),
      new Document({
        pageContent: "Machine learning and artificial intelligence",
      }),
      new Document({ pageContent: "Elasticsearch vector search capabilities" }),
      new Document({ pageContent: "A fox in the forest during autumn" }),
    ]);

    const results = await store.similaritySearch("fox in the woods", 2);

    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Document);
    expect(results.some((doc) => doc.pageContent.includes("fox"))).toBe(true);
  });

  test.skip("Hybrid search with custom RRF parameters", async () => {
    const indexName = "test_hybrid_custom_rrf";
    const store = new ElasticVectorSearch(embeddings, {
      client,
      indexName,
      strategy: new HybridRetrievalStrategy({
        rankWindowSize: 200,
        rankConstant: 80,
        textField: "text",
      }),
    });
    await store.deleteIfExists();

    await store.addDocuments([
      new Document({ pageContent: "search engines and databases" }),
      new Document({ pageContent: "vector embeddings for search" }),
      new Document({ pageContent: "neural networks and deep learning" }),
    ]);

    const results = await store.similaritySearch("search technology", 2);

    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Document);
  });

  test.skip("Hybrid search returns scores correctly", async () => {
    const indexName = "test_hybrid_scores";
    const store = new ElasticVectorSearch(embeddings, {
      client,
      indexName,
      strategy: new HybridRetrievalStrategy(),
    });
    await store.deleteIfExists();

    await store.addDocuments([
      new Document({ pageContent: "Elasticsearch hybrid search" }),
      new Document({ pageContent: "Vector similarity search" }),
      new Document({ pageContent: "Full text search with BM25" }),
    ]);

    const queryVector = await embeddings.embedQuery("hybrid search");
    const results = await store.similaritySearchVectorWithScore(queryVector, 3);

    expect(results).toHaveLength(3);
    results.forEach(([doc, score]) => {
      expect(doc).toBeInstanceOf(Document);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThan(0);
    });
  });

  test.skip("Hybrid search with metadata filters", async () => {
    const indexName = "test_hybrid_filters";
    const store = new ElasticVectorSearch(embeddings, {
      client,
      indexName,
      strategy: new HybridRetrievalStrategy(),
    });
    await store.deleteIfExists();

    const createdAt = new Date().getTime();
    await store.addDocuments([
      new Document({
        pageContent: "Technology article about AI",
        metadata: { category: "tech", date: createdAt },
      }),
      new Document({
        pageContent: "Sports article about football",
        metadata: { category: "sports", date: createdAt },
      }),
      new Document({
        pageContent: "Technology article about ML",
        metadata: { category: "tech", date: createdAt },
      }),
      new Document({
        pageContent: "Sports article about basketball",
        metadata: { category: "sports", date: createdAt + 1 },
      }),
    ]);

    const results = await store.similaritySearch(
      "article about technology",
      5,
      {
        category: "tech",
      }
    );

    expect(results.length).toBeLessThanOrEqual(2);
    results.forEach((doc) => {
      expect(doc.metadata.category).toBe("tech");
    });
  });
});
