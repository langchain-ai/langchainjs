/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { Client, ClientOptions } from "@elastic/elasticsearch";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { ElasticVectorSearch } from "../elasticsearch.js";

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

    console.log(`Upserted:`, results3);

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
      { pageContent: "generous", metadata: { a: createdAt } },
      { pageContent: "compassionate", metadata: { a: createdAt } },
    ]);
    const results = await store.similaritySearch("*", 11);
    expect(results).toHaveLength(11);
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
