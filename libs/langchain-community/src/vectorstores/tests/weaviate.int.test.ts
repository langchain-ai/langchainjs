/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import weaviate from "weaviate-ts-client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { WeaviateStore } from "../weaviate.js";

test("WeaviateStore", async () => {
  // Something wrong with the weaviate-ts-client types, so we need to disable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (weaviate as any).client({
    scheme:
      process.env.WEAVIATE_SCHEME ||
      (process.env.WEAVIATE_HOST ? "https" : "http"),
    host: process.env.WEAVIATE_HOST || "localhost:8080",
    apiKey: process.env.WEAVIATE_API_KEY
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (weaviate as any).ApiKey(process.env.WEAVIATE_API_KEY)
      : undefined,
  });
  const store = await WeaviateStore.fromTexts(
    ["hello world", "hi there", "how are you", "bye now"],
    [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "Test",
      textKey: "text",
      metadataKeys: ["foo"],
    }
  );

  const results = await store.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({ pageContent: "hello world", metadata: { foo: "bar" } }),
  ]);

  const results2 = await store.similaritySearch("hello world", 1, {
    where: {
      operator: "Equal",
      path: ["foo"],
      valueText: "baz",
    },
  });
  expect(results2).toEqual([
    new Document({ pageContent: "hi there", metadata: { foo: "baz" } }),
  ]);

  const testDocumentWithObjectMetadata = new Document({
    pageContent: "this is the deep document world!",
    metadata: {
      deep: {
        string: "deep string",
        deepdeep: {
          string: "even a deeper string",
        },
      },
    },
  });
  const documentStore = await WeaviateStore.fromDocuments(
    [testDocumentWithObjectMetadata],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "DocumentTest",
      textKey: "text",
      metadataKeys: ["deep_string", "deep_deepdeep_string"],
    }
  );

  const result3 = await documentStore.similaritySearch(
    "this is the deep document world!",
    1,
    {
      where: {
        operator: "Equal",
        path: ["deep_string"],
        valueText: "deep string",
      },
    }
  );
  expect(result3).toEqual([
    new Document({
      pageContent: "this is the deep document world!",
      metadata: {
        deep_string: "deep string",
        deep_deepdeep_string: "even a deeper string",
      },
    }),
  ]);
});

test("WeaviateStore upsert + delete", async () => {
  // Something wrong with the weaviate-ts-client types, so we need to disable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (weaviate as any).client({
    scheme:
      process.env.WEAVIATE_SCHEME ||
      (process.env.WEAVIATE_HOST ? "https" : "http"),
    host: process.env.WEAVIATE_HOST || "localhost:8080",
    apiKey: process.env.WEAVIATE_API_KEY
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (weaviate as any).ApiKey(process.env.WEAVIATE_API_KEY)
      : undefined,
  });
  const createdAt = new Date().getTime();
  const store = await WeaviateStore.fromDocuments(
    [
      new Document({
        pageContent: "testing",
        metadata: { deletionTest: createdAt.toString() },
      }),
    ],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "DocumentTest",
      textKey: "pageContent",
      metadataKeys: ["deletionTest"],
    }
  );

  const ids = await store.addDocuments([
    {
      pageContent: "hello world",
      metadata: { deletionTest: (createdAt + 1).toString() },
    },
    {
      pageContent: "hello world",
      metadata: { deletionTest: (createdAt + 1).toString() },
    },
  ]);

  const results = await store.similaritySearch("hello world", 4, {
    where: {
      operator: "Equal",
      path: ["deletionTest"],
      valueText: (createdAt + 1).toString(),
    },
  });
  expect(results).toEqual([
    new Document({
      pageContent: "hello world",
      metadata: { deletionTest: (createdAt + 1).toString() },
    }),
    new Document({
      pageContent: "hello world",
      metadata: { deletionTest: (createdAt + 1).toString() },
    }),
  ]);

  const ids2 = await store.addDocuments(
    [
      {
        pageContent: "hello world upserted",
        metadata: { deletionTest: (createdAt + 1).toString() },
      },
      {
        pageContent: "hello world upserted",
        metadata: { deletionTest: (createdAt + 1).toString() },
      },
    ],
    { ids }
  );

  expect(ids2).toEqual(ids);

  const results2 = await store.similaritySearch("hello world", 4, {
    where: {
      operator: "Equal",
      path: ["deletionTest"],
      valueText: (createdAt + 1).toString(),
    },
  });
  expect(results2).toEqual([
    new Document({
      pageContent: "hello world upserted",
      metadata: { deletionTest: (createdAt + 1).toString() },
    }),
    new Document({
      pageContent: "hello world upserted",
      metadata: { deletionTest: (createdAt + 1).toString() },
    }),
  ]);

  await store.delete({ ids: ids.slice(0, 1) });

  const results3 = await store.similaritySearch("hello world", 1, {
    where: {
      operator: "Equal",
      path: ["deletionTest"],
      valueText: (createdAt + 1).toString(),
    },
  });
  expect(results3).toEqual([
    new Document({
      pageContent: "hello world upserted",
      metadata: { deletionTest: (createdAt + 1).toString() },
    }),
  ]);
});

test("WeaviateStore delete with filter", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (weaviate as any).client({
    scheme:
      process.env.WEAVIATE_SCHEME ||
      (process.env.WEAVIATE_HOST ? "https" : "http"),
    host: process.env.WEAVIATE_HOST || "localhost:8080",
    apiKey: process.env.WEAVIATE_API_KEY
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (weaviate as any).ApiKey(process.env.WEAVIATE_API_KEY)
      : undefined,
  });
  const store = await WeaviateStore.fromTexts(
    ["hello world", "hi there", "how are you", "bye now"],
    [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "FilterDeletionTest",
      textKey: "text",
      metadataKeys: ["foo"],
    }
  );
  const results = await store.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({ pageContent: "hello world", metadata: { foo: "bar" } }),
  ]);
  await store.delete({
    filter: {
      where: {
        operator: "Equal",
        path: ["foo"],
        valueText: "bar",
      },
    },
  });
  const results2 = await store.similaritySearch("hello world", 1, {
    where: {
      operator: "Equal",
      path: ["foo"],
      valueText: "bar",
    },
  });
  expect(results2).toEqual([]);
});
