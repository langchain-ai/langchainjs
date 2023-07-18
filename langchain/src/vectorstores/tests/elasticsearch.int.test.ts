/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { Client } from "@elastic/elasticsearch";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { ElasticVectorSearch } from "../elasticsearch.js";
import { Document } from "../../document.js";

test.skip("ElasticVectorSearch integration", async () => {
  if (!process.env.ELASTIC_URL) {
    throw new Error("ELASTIC_URL not set");
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const config: any = {
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

  const embeddings = new OpenAIEmbeddings(undefined, {
    baseOptions: { temperature: 0 },
  });
  const store = new ElasticVectorSearch(embeddings, { client, indexName });
  await store.deleteIfExists();

  expect(store).toBeDefined();

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
