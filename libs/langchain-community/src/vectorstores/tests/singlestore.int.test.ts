/* eslint-disable no-process-env */
/* eslint-disable import/no-extraneous-dependencies */
import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { SingleStoreVectorStore } from "../singlestore.js";

test.skip("SingleStoreVectorStore", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();

  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionOptions: {
        host: process.env.SINGLESTORE_HOST,
        port: Number(process.env.SINGLESTORE_PORT),
        user: process.env.SINGLESTORE_USERNAME,
        password: process.env.SINGLESTORE_PASSWORD,
        database: process.env.SINGLESTORE_DATABASE,
      },
      contentColumnName: "cont",
      metadataColumnName: "met",
      vectorColumnName: "vec",
    }
  );
  expect(vectorStore).toBeDefined();

  const results = await vectorStore.similaritySearch("hello world", 1);

  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  await vectorStore.addDocuments([
    new Document({
      pageContent: "Green forest",
      metadata: { id: 4, name: "4" },
    }),
    new Document({
      pageContent: "Green field",
      metadata: { id: 5, name: "5" },
    }),
  ]);

  const results2 = await vectorStore.similaritySearch("forest", 1);

  expect(results2).toEqual([
    new Document({
      pageContent: "Green forest",
      metadata: { id: 4, name: "4" },
    }),
  ]);

  await vectorStore.end();
});

test.skip("SingleStoreVectorStore euclidean_distance", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();

  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "euclidean_distance_test",
      distanceMetric: "EUCLIDEAN_DISTANCE",
    }
  );
  expect(vectorStore).toBeDefined();

  const results = await vectorStore.similaritySearch("hello world", 1);

  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  await vectorStore.end();
});

test.skip("SingleStoreVectorStore filtering", async () => {
  expect(process.env.SINGLESTORE_HOST).toBeDefined();
  expect(process.env.SINGLESTORE_PORT).toBeDefined();
  expect(process.env.SINGLESTORE_USERNAME).toBeDefined();
  expect(process.env.SINGLESTORE_PASSWORD).toBeDefined();
  expect(process.env.SINGLESTORE_DATABASE).toBeDefined();

  const vectorStore = await SingleStoreVectorStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionURI: `http://${process.env.SINGLESTORE_USERNAME}:${process.env.SINGLESTORE_PASSWORD}@${process.env.SINGLESTORE_HOST}:${process.env.SINGLESTORE_PORT}/${process.env.SINGLESTORE_DATABASE}`,
      tableName: "filtering_test",
    }
  );
  expect(vectorStore).toBeDefined();

  const results1 = await vectorStore.similaritySearch("hello world", 1, {
    id: 3,
  });

  expect(results1).toEqual([
    new Document({
      pageContent: "hello nice world",
      metadata: { id: 3, name: "3" },
    }),
  ]);

  const results2 = await vectorStore.similaritySearch("hello nice world", 1, {
    name: "2",
  });
  expect(results2).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
    }),
  ]);

  const results3 = await vectorStore.similaritySearch("hello nice world", 1, {
    sub: { sub2: { idx: 1 } },
  });
  expect(results3).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
    }),
  ]);

  const results4 = await vectorStore.similaritySearch("hello nice world", 1, {
    name: "2",
    id: 2,
  });
  expect(results4).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2", sub: { sub2: { idx: 1 } } },
    }),
  ]);

  const results5 = await vectorStore.similaritySearch("hello nice world", 1, {
    name: "3",
    sub: { sub2: { idx: 1 } },
  });
  expect(results5).toEqual([]);
  await vectorStore.end();
});
