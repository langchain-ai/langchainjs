/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { Client } from "@opensearch-project/opensearch";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { OpenSearchVectorStore } from "../opensearch.js";

test.skip("OpenSearchVectorStore integration", async () => {
  if (!process.env.OPENSEARCH_URL) {
    throw new Error("OPENSEARCH_URL not set");
  }

  const client = new Client({
    nodes: [process.env.OPENSEARCH_URL],
  });

  const indexName = "test_index";

  const embeddings = new OpenAIEmbeddings();
  const store = new OpenSearchVectorStore(embeddings, { client, indexName });
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
