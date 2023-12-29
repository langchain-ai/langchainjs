import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { TurbopufferVectorStore } from "../turbopuffer.js";

test("similaritySearchVectorWithScore", async () => {
  const embeddings = new OpenAIEmbeddings();

  const store = new TurbopufferVectorStore(embeddings, {
    apiKey: getEnvironmentVariable("TURBOPUFFER_API_KEY"),
    namespace: "langchain-js-testing"
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  await store.addDocuments([
    { pageContent: createdAt.toString(), metadata: { a: createdAt } },
    { pageContent: "hi", metadata: { a: createdAt } },
    { pageContent: "bye", metadata: { a: createdAt } },
    { pageContent: "what's this", metadata: { a: createdAt } }
  ]);
  console.log("added docs");
  const results = await store.similaritySearch(createdAt.toString(), 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({
      metadata: { a: createdAt },
      pageContent: createdAt.toString()
    })
  ]);
});

test.only("similaritySearchVectorWithScore with a passed filter", async () => {
  const embeddings = new OpenAIEmbeddings();

  const store = new TurbopufferVectorStore(embeddings, {
    apiKey: getEnvironmentVariable("TURBOPUFFER_API_KEY"),
    namespace: "langchain-js-testing"
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  await store.addDocuments([
    { pageContent: "hello 0", metadata: { created_at: createdAt } },
    { pageContent: "hello 1", metadata: { created_at: createdAt + 1 } },
    { pageContent: "hello 2", metadata: { created_at: createdAt + 2 } },
    { pageContent: "hello 3", metadata: { created_at: createdAt + 3 } }
  ]);

  const results = await store.similaritySearch("hello", 1, {
    metadata: [["Eq", `{"created_at": ${createdAt}}`]]
  });

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({
      metadata: { created_at: (createdAt + 2).toString() },
      pageContent: "hello 2"
    })
  ]);
});
