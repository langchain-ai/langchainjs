import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { TurbopufferVectorStore } from "../turbopuffer.js";

beforeEach(async () => {
  const embeddings = new OpenAIEmbeddings();
  const store = new TurbopufferVectorStore(embeddings, {
    apiKey: getEnvironmentVariable("TURBOPUFFER_API_KEY"),
    namespace: "langchain-js-testing",
  });
  await store.delete({
    deleteIndex: true,
  });
});

test("similaritySearchVectorWithScore", async () => {
  const embeddings = new OpenAIEmbeddings();

  const store = new TurbopufferVectorStore(embeddings, {
    apiKey: getEnvironmentVariable("TURBOPUFFER_API_KEY"),
    namespace: "langchain-js-testing",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().toString();

  await store.addDocuments([
    { pageContent: createdAt.toString(), metadata: { a: createdAt } },
    { pageContent: "hi", metadata: { a: createdAt } },
    { pageContent: "bye", metadata: { a: createdAt } },
    { pageContent: "what's this", metadata: { a: createdAt } },
  ]);
  // console.log("added docs");
  const results = await store.similaritySearch(createdAt.toString(), 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({
      metadata: { a: createdAt },
      pageContent: createdAt.toString(),
    }),
  ]);
});

test("similaritySearch with a passed filter", async () => {
  const embeddings = new OpenAIEmbeddings();

  const store = new TurbopufferVectorStore(embeddings, {
    apiKey: getEnvironmentVariable("TURBOPUFFER_API_KEY"),
    namespace: "langchain-js-testing",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  await store.addDocuments([
    { pageContent: "hello 0", metadata: { created_at: createdAt.toString() } },
    {
      pageContent: "hello 1",
      metadata: { created_at: (createdAt + 1).toString() },
    },
    {
      pageContent: "hello 2",
      metadata: { created_at: (createdAt + 2).toString() },
    },
    {
      pageContent: "hello 3",
      metadata: { created_at: (createdAt + 3).toString() },
    },
  ]);

  const results = await store.similaritySearch("hello", 1, {
    created_at: [["Eq", (createdAt + 2).toString()]],
  });

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({
      metadata: { created_at: (createdAt + 2).toString() },
      pageContent: "hello 2",
    }),
  ]);
});

test("Should drop metadata keys from docs with non-string metadata", async () => {
  const embeddings = new OpenAIEmbeddings();

  const store = new TurbopufferVectorStore(embeddings, {
    apiKey: getEnvironmentVariable("TURBOPUFFER_API_KEY"),
    namespace: "langchain-js-testing",
  });

  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  await store.addDocuments([
    {
      pageContent: "hello 0",
      metadata: { created_at: { time: createdAt.toString() } },
    },
    {
      pageContent: "goodbye",
      metadata: { created_at: (createdAt + 1).toString() },
    },
  ]);

  const results = await store.similaritySearch("hello", 1, {
    created_at: [["Eq", createdAt.toString()]],
  });

  expect(results).toHaveLength(0);

  const results2 = await store.similaritySearch("hello", 1);

  expect(results2).toEqual([
    new Document({
      metadata: {
        created_at: null,
      },
      pageContent: "hello 0",
    }),
  ]);
});
