/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import weaviate, { Filters, WeaviateClient } from "weaviate-client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import * as dotenv from "dotenv";
import { WeaviateStore } from "../vectorstores.js";

dotenv.config();
let client: WeaviateClient;

beforeAll(async () => {
  expect(process.env.WEAVIATE_URL).toBeDefined();
  expect(process.env.WEAVIATE_URL!.length).toBeGreaterThan(0);
  client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL!, {
    authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ""),
    headers: {
      "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY || "",
      "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || "",
    },
  });
});

test("WeaviateStore", async () => {
  const embeddings = new OpenAIEmbeddings();
  const weaviateArgs = {
    client,
    indexName: "Test",
    textKey: "text",
    metadataKeys: ["foo"],
  };
  try {
    const store = await WeaviateStore.fromTexts(
      ["hello world", "hi there", "how are you", "bye now"],
      [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
      embeddings,
      weaviateArgs
    );
    const collection = client.collections.get(weaviateArgs.indexName);
    const results = await store.similaritySearch("hello world", 1);
    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world",
        metadata: { foo: "bar" },
      }),
    ]);

    const results2 = await store.similaritySearch(
      "hello world",
      1,
      Filters.and(collection.filter.byProperty("foo").equal("baz"))
    );

    expect(results2).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hi there",
        metadata: { foo: "baz" },
      }),
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
      Filters.and(
        collection.filter.byProperty("deep_string").equal("deep string")
      )
    );
    expect(result3).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "this is the deep document world!",
        metadata: {
          deep_string: "deep string",
          deep_deepdeep_string: "even a deeper string",
        },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

test("WeaviateStore upsert + delete", async () => {
  const createdAt = new Date().getTime();
  const weaviateArgs = {
    client,
    indexName: "DocumentTest",
    textKey: "pageContent",
    metadataKeys: ["deletionTest"],
  };
  try {
    const store = await WeaviateStore.fromDocuments(
      [
        new Document({
          pageContent: "testing",
          metadata: { deletionTest: createdAt.toString() },
        }),
      ],
      new OpenAIEmbeddings(),
      weaviateArgs
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
    const collection = client.collections.get(weaviateArgs.indexName);
    const results = await store.similaritySearch(
      "hello world",
      4,
      collection.filter
        .byProperty("deletionTest")
        .equal((createdAt + 1).toString())
    );

    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world",
        metadata: { deletionTest: (createdAt + 1).toString() },
      }),
      new Document({
        id: expect.any(String) as unknown as string,
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
    const results2 = await store.similaritySearch(
      "hello world",
      4,
      Filters.and(
        collection.filter
          .byProperty("deletionTest")
          .equal((createdAt + 1).toString())
      )
    );
    expect(results2).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world upserted",
        metadata: { deletionTest: (createdAt + 1).toString() },
      }),
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world upserted",
        metadata: { deletionTest: (createdAt + 1).toString() },
      }),
    ]);

    await store.delete({ ids: ids.slice(0, 1) });
    const results3 = await store.similaritySearch(
      "hello world",
      1,
      Filters.and(
        collection.filter
          .byProperty("deletionTest")
          .equal((createdAt + 1).toString())
      )
    );
    expect(results3).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world upserted",
        metadata: { deletionTest: (createdAt + 1).toString() },
      }),
    ]);
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

test("WeaviateStore with tenant", async () => {
  const weaviateArgs = {
    client,
    indexName: "TestTenant1",
    textKey: "text",
    tenant: "tenant1",
    metadataKeys: ["foo"],
  };
  const store = await WeaviateStore.fromTexts(
    ["hello world", "hi there", "how are you", "bye now"],
    [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
    new OpenAIEmbeddings(),
    weaviateArgs
  );
  const collection = client.collections.get(weaviateArgs.indexName);
  try {
    const results = await store.similaritySearch("hello world", 1);
    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world",
        metadata: { foo: "bar" },
      }),
    ]);
    await store.delete({
      filter: collection.filter.byProperty("foo").equal("bar"),
    });
    const results2 = await store.similaritySearch(
      "hello world",
      1,
      collection.filter.byProperty("foo").equal("bar")
    );
    expect(results2).toEqual([]);
  } finally {
    await collection.tenants.remove([{ name: weaviateArgs.tenant }]);
    await client.collections.delete(weaviateArgs.indexName);
  }
});

test("WeaviateStore delete with filter", async () => {
  const weaviateArgs = {
    client,
    indexName: "Test",
    textKey: "text",
    metadataKeys: ["foo"],
  };
  try {
    const store = await WeaviateStore.fromTexts(
      ["hello world", "hi there", "how are you", "bye now"],
      [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
      new OpenAIEmbeddings(),
      weaviateArgs
    );
    const collection = client.collections.get(weaviateArgs.indexName);
    const results = await store.similaritySearch("hello world", 1);
    expect(results).toEqual([
      new Document({
        id: expect.any(String) as unknown as string,
        pageContent: "hello world",
        metadata: { foo: "bar" },
      }),
    ]);
    await store.delete({
      filter: collection.filter.byProperty("foo").equal("bar"),
    });
    const results2 = await store.similaritySearch(
      "hello world",
      1,
      collection.filter.byProperty("foo").equal("bar")
    );
    expect(results2).toEqual([]);
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

test("Initializing via constructor", async () => {
  const weaviateArgs = {
    client,
    indexName: "Test",
    textKey: "text",
    metadataKeys: ["foo"],
  };
  try {
    const store = new WeaviateStore(new OpenAIEmbeddings(), weaviateArgs);

    expect(store).toBeDefined();
    expect(store._vectorstoreType()).toBe("weaviate");
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

test("addDocuments & addVectors method works", async () => {
  try {
    const store = new WeaviateStore(new OpenAIEmbeddings(), {
      client,
      indexName: "Test",
      textKey: "text",
      metadataKeys: ["foo"],
    });

    const documents = [
      new Document({ pageContent: "hello world", metadata: { foo: "bar" } }),
      new Document({ pageContent: "hi there", metadata: { foo: "baz" } }),
      new Document({ pageContent: "how are you", metadata: { foo: "qux" } }),
      new Document({ pageContent: "bye now", metadata: { foo: "bar" } }),
    ];

    const embeddings = await store.embeddings.embedDocuments(
      documents.map((d) => d.pageContent)
    );

    const vectors = await store.addVectors(embeddings, documents);
    expect(vectors).toHaveLength(4);
  } finally {
    await client.collections.delete("Test");
  }
});

test("maxMarginalRelevanceSearch", async () => {
  const createdAt = new Date().getTime();

  const fatherDoc = new Document({
    pageContent: "hello father",
    metadata: { deletionTest: (createdAt + 3).toString() },
  });
  const weaviateArgs = {
    client,
    indexName: "DocumentTest",
    textKey: "pageContent",
    metadataKeys: ["deletionTest"],
  };
  try {
    const store = await WeaviateStore.fromDocuments(
      [
        new Document({
          pageContent: "testing",
          metadata: { deletionTest: createdAt.toString() },
        }),
        new Document({
          pageContent: "hello world",
          metadata: { deletionTest: (createdAt + 1).toString() },
        }),
        new Document({
          pageContent: "hello mother",
          metadata: { deletionTest: (createdAt + 2).toString() },
        }),
        fatherDoc,
      ],
      new OpenAIEmbeddings(),
      weaviateArgs
    );

    const result = await store.maxMarginalRelevanceSearch("father", { k: 1 });
    expect(result[0].pageContent).toEqual(fatherDoc.pageContent);
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

test("fromExistingIndex", async () => {
  const weaviateArgs = {
    client,
    indexName: "DocumentTest",
    textKey: "pageContent",
    metadataKeys: ["deletionTest"],
  };
  try {
    const store = await WeaviateStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      weaviateArgs
    );

    expect(store).toBeDefined();
    expect(store._vectorstoreType()).toBe("weaviate");
  } finally {
    await client.collections.delete(weaviateArgs.indexName);
  }
});

afterAll(async () => {
  await client.close();
});
