/* eslint-disable no-process-env */
/* eslint-disable import/no-extraneous-dependencies */
import { test } from "@jest/globals";

import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { AnalyticDBVectorStore } from "../analyticdb.js";

const connectionOptions = {
  host: process.env.ANALYTICDB_HOST || "localhost",
  port: Number(process.env.ANALYTICDB_PORT) || 5432,
  database: process.env.ANALYTICDB_DATABASE || "your_database",
  user: process.env.ANALYTICDB_USERNAME || "username",
  password: process.env.ANALYTICDB_PASSWORD || "password",
};

const embeddings = new OpenAIEmbeddings();
const _LANGCHAIN_DEFAULT_EMBEDDING_DIM = 1536;

beforeAll(async () => {
  expect(process.env.ANALYTICDB_HOST).toBeDefined();
  expect(process.env.ANALYTICDB_PORT).toBeDefined();
  expect(process.env.ANALYTICDB_DATABASE).toBeDefined();
  expect(process.env.ANALYTICDB_USERNAME).toBeDefined();
  expect(process.env.ANALYTICDB_USERNAME).toBeDefined();
});

test.skip("test analyticdb", async () => {
  const vectorStore = new AnalyticDBVectorStore(embeddings, {
    connectionOptions,
    collectionName: "test_collection",
    preDeleteCollection: true,
  });
  expect(vectorStore).toBeDefined();

  const createdAt = new Date().getTime();
  await vectorStore.addDocuments([
    { pageContent: "hi", metadata: { a: createdAt } },
    { pageContent: "bye", metadata: { a: createdAt } },
    { pageContent: "what's this", metadata: { a: createdAt } },
    { pageContent: createdAt.toString(), metadata: { a: createdAt } },
  ]);

  const results = await vectorStore.similaritySearch("what's this", 1);

  expect(results).toHaveLength(1);
  expect(results).toEqual([
    new Document({
      pageContent: "what's this",
      metadata: { a: createdAt },
    }),
  ]);

  await vectorStore.end();
});

test.skip("test analyticdb using filter", async () => {
  const vectorStore = new AnalyticDBVectorStore(embeddings, {
    connectionOptions,
    collectionName: "test_collection",
    embeddingDimension: _LANGCHAIN_DEFAULT_EMBEDDING_DIM,
    preDeleteCollection: true,
  });
  expect(vectorStore).toBeDefined();

  const createdAt = new Date().getTime();
  await vectorStore.addDocuments([
    { pageContent: "foo", metadata: { a: createdAt, b: createdAt + 6 } },
    { pageContent: "bar", metadata: { a: createdAt + 1, b: createdAt + 7 } },
    { pageContent: "baz", metadata: { a: createdAt + 2, b: createdAt + 8 } },
    { pageContent: "foo", metadata: { a: createdAt + 3, b: createdAt + 9 } },
    { pageContent: "bar", metadata: { a: createdAt + 4, b: createdAt + 10 } },
    { pageContent: "baz", metadata: { a: createdAt + 5, b: createdAt + 11 } },
  ]);

  const results = await vectorStore.similaritySearch("bar", 1, {
    a: createdAt + 4,
    b: createdAt + 10,
  });

  expect(results).toHaveLength(1);
  expect(results).toEqual([
    new Document({
      pageContent: "bar",
      metadata: { a: createdAt + 4, b: createdAt + 10 },
    }),
  ]);

  await vectorStore.end();
});

test.skip("test analyticdb from texts", async () => {
  const vectorStore = await AnalyticDBVectorStore.fromTexts(
    ["Bye bye", "Hello world", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    embeddings,
    {
      connectionOptions,
      collectionName: "test_collection",
      embeddingDimension: _LANGCHAIN_DEFAULT_EMBEDDING_DIM,
      preDeleteCollection: true,
    }
  );
  expect(vectorStore).toBeDefined();

  const results = await vectorStore.similaritySearch("hello world", 1);

  expect(results).toHaveLength(1);
  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 1, name: "1" },
    }),
  ]);

  await vectorStore.end();
});

test.skip("test analyticdb from existing index", async () => {
  await AnalyticDBVectorStore.fromTexts(
    ["Bye bye", "Hello world", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    embeddings,
    {
      connectionOptions,
      collectionName: "test_collection",
      embeddingDimension: _LANGCHAIN_DEFAULT_EMBEDDING_DIM,
      preDeleteCollection: true,
    }
  );

  const vectorStore = await AnalyticDBVectorStore.fromExistingIndex(
    embeddings,
    {
      connectionOptions,
      collectionName: "test_collection",
      embeddingDimension: _LANGCHAIN_DEFAULT_EMBEDDING_DIM,
      preDeleteCollection: false,
    }
  );

  const result1 = await vectorStore.similaritySearch("hello world", 1);
  expect(result1).toHaveLength(1);
  expect(result1).toEqual([
    { pageContent: "Hello world", metadata: { id: 1, name: "1" } },
  ]);

  await vectorStore.addDocuments([
    { pageContent: "bar", metadata: { id: 4, name: "4" } },
    { pageContent: "baz", metadata: { id: 5, name: "5" } },
  ]);

  const result2 = await vectorStore.similaritySearch("bar", 2);
  expect(result2).toHaveLength(2);
  expect(result2).toEqual([
    { pageContent: "bar", metadata: { id: 4, name: "4" } },
    { pageContent: "baz", metadata: { id: 5, name: "5" } },
  ]);

  await vectorStore.end();
});
