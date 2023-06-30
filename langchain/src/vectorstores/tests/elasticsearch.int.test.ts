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

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 2 } },
    { pageContent: "car", metadata: { a: 1 } },
    { pageContent: "adjective", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
  ]);

  const results1 = await store.similaritySearch("hello!", 1);

  expect(results1).toHaveLength(1);
  expect(results1).toEqual([
    new Document({ metadata: { a: 2 }, pageContent: "hello" }),
  ]);

  const results2 = await store.similaritySearchWithScore("hello!", 1, {
    a: 1,
  });

  expect(results2).toHaveLength(1);
});
