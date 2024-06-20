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

  test('keywordSearchWithScore should return documents with scores', async () => {
    const query = 'example query';
    const k = 10;
    const results = await store.keywordSearchWithScore(query, k);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeLessThanOrEqual(k);
    results.forEach(([document, score]) => {
      expect(document).toBeInstanceOf(Document);
      expect(typeof score).toBe('number');
    });
  });

  test('keywordSearchWithScore should handle errors', async () => {
    const query = 'invalid query';
    const k = 10;
    vectorStore.client.search = jest.fn().mockRejectedValue(new Error('Search error'));

    await expect(store.keywordSearchWithScore(query, k)).rejects.toThrow('Search error');
  });
});
