import { test, expect, afterAll, beforeAll, describe } from "vitest";

import { GlideClient } from "@valkey/valkey-glide";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";

import { ValkeyVectorStore, SchemaFieldTypes } from "../vectorstores.js";

describe("ValkeyVectorStore", () => {
  let vectorStore: ValkeyVectorStore;
  let client: GlideClient;

  beforeAll(async () => {
    client = await GlideClient.createClient({
      addresses: [
        {
          host: process.env.VALKEY_HOST || "localhost",
          port: parseInt(process.env.VALKEY_PORT || "6379"),
        },
      ],
    });

    vectorStore = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-index",
      keyPrefix: "test:",
    });
  });

  afterAll(async () => {
    await vectorStore.delete({ deleteAll: true });
    client.close();
  });

  test("auto-generated ids", async () => {
    const pageContent = faker.lorem.sentence(5);

    await vectorStore.addDocuments([{ pageContent, metadata: { foo: "bar" } }]);

    const results = await vectorStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: { foo: "bar" }, pageContent }),
    ]);
  });

  test("user-provided keys", async () => {
    const documentKey = `test:${uuidv4()}`;
    const pageContent = faker.lorem.sentence(5);

    await vectorStore.addDocuments([{ pageContent, metadata: {} }], {
      keys: [documentKey],
    });

    const results = await vectorStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([new Document({ metadata: {}, pageContent })]);
  });

  test("metadata filtering", async () => {
    await vectorStore.dropIndex();
    const pageContent = faker.lorem.sentence(5);
    const uuid = uuidv4();

    // Create a store with custom schema for filtering
    const storeWithSchema = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-index-filter",
      keyPrefix: "test-filter:",
      customSchema: {
        foo: { type: SchemaFieldTypes.TAG },
      },
    });

    await storeWithSchema.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: uuid } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    const results =
      await storeWithSchema.similaritySearchVectorWithScoreAndMetadata(
        await new SyntheticEmbeddings().embedQuery(pageContent),
        3,
        { foo: uuid }
      );

    expect(results).toHaveLength(1);
    expect(results[0][0].metadata.foo).toBe(uuid);

    await storeWithSchema.delete({ deleteAll: true });
  });

  test("delete documents by ids", async () => {
    const documentKeys = ["test:doc1", "test:doc2"];
    const pageContent = faker.lorem.sentence(5);

    const documents = documentKeys.map((key) => ({
      pageContent,
      metadata: {
        id: key,
      },
    }));

    await vectorStore.addDocuments(documents, {
      keys: documentKeys,
    });

    const results = await vectorStore.similaritySearch(pageContent, 2);
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.metadata.id)).toEqual(documentKeys);

    await vectorStore.delete({ ids: [documentKeys[0]] });

    const results2 = await vectorStore.similaritySearch(pageContent, 2);
    expect(results2).toHaveLength(1);
    expect(results2.map((result) => result.metadata.id)).toEqual(
      documentKeys.slice(1)
    );
  });

  test("delete all documents", async () => {
    await vectorStore.dropIndex();
    const pageContent = faker.lorem.sentence(5);

    await vectorStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: "baz" } },
    ]);

    let results = await vectorStore.similaritySearch(pageContent, 2);
    expect(results).toHaveLength(2);

    await vectorStore.delete({ deleteAll: true });

    results = await vectorStore.similaritySearch(pageContent, 2);
    expect(results).toHaveLength(0);
  });

  test("with TTL", async () => {
    const ttl = 2;
    const storeWithTTL = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-ttl-index",
      keyPrefix: "test-ttl:",
      ttl,
    });

    const pageContent = faker.lorem.sentence(5);
    await storeWithTTL.addDocuments([{ pageContent, metadata: {} }]);

    let results = await storeWithTTL.similaritySearch(pageContent, 1);
    expect(results).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    results = await storeWithTTL.similaritySearch(pageContent, 1);
    expect(results).toHaveLength(0);

    await storeWithTTL.delete({ deleteAll: true });
  });
});

describe("ValkeyVectorStore with Custom Schema", () => {
  let client: GlideClient;

  beforeAll(async () => {
    client = await GlideClient.createClient({
      addresses: [
        {
          host: process.env.VALKEY_HOST || "localhost",
          port: parseInt(process.env.VALKEY_PORT || "6379"),
        },
      ],
    });
  });

  afterAll(async () => {
    client.close();
  });

  test("validates required fields", async () => {
    const customSchema = {
      userId: { type: SchemaFieldTypes.TAG, required: true },
    };

    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-required",
      customSchema,
    });

    await expect(
      store.addDocuments([{ pageContent: "test", metadata: {} }])
    ).rejects.toThrow("Required metadata field 'userId' is missing");

    await store.delete({ deleteAll: true });
  });

  test("validates field types", async () => {
    const customSchema = {
      score: { type: SchemaFieldTypes.NUMERIC, required: true },
    };

    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-types",
      customSchema,
    });

    await expect(
      store.addDocuments([
        { pageContent: "test", metadata: { score: "not-a-number" } },
      ])
    ).rejects.toThrow("Metadata field 'score' must be a number");

    await store.delete({ deleteAll: true });
  });

  test("stores and retrieves with custom schema", async () => {
    const customSchema = {
      userId: { type: SchemaFieldTypes.TAG },
      category: { type: SchemaFieldTypes.TAG },
      score: { type: SchemaFieldTypes.NUMERIC },
    };

    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-custom-schema",
      keyPrefix: "custom:",
      customSchema,
    });

    const pageContent = faker.lorem.sentence(5);
    await store.addDocuments([
      {
        pageContent,
        metadata: { userId: "user123", category: "tech", score: 95 },
      },
    ]);

    const results = await store.similaritySearch(pageContent, 1);
    expect(results).toHaveLength(1);
    expect(results[0].metadata).toEqual({
      userId: "user123",
      category: "tech",
      score: 95,
    });

    await store.delete({ deleteAll: true });
  });

  test("filters with custom metadata fields", async () => {
    const customSchema = {
      category: { type: SchemaFieldTypes.TAG },
      score: { type: SchemaFieldTypes.NUMERIC },
    };

    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-custom-filter",
      keyPrefix: "filter:",
      customSchema,
    });

    const pageContent = faker.lorem.sentence(5);
    await store.addDocuments([
      { pageContent, metadata: { category: "tech", score: 95 } },
      { pageContent, metadata: { category: "science", score: 87 } },
      { pageContent, metadata: { category: "tech", score: 82 } },
    ]);

    const results = await store.similaritySearchVectorWithScoreAndMetadata(
      await new SyntheticEmbeddings().embedQuery(pageContent),
      3,
      { category: "tech", score: { min: 90 } }
    );

    expect(results).toHaveLength(1);
    expect(results[0][0].metadata.category).toBe("tech");
    expect(results[0][0].metadata.score).toBe(95);

    await store.delete({ deleteAll: true });
  });

  test("handles tag arrays", async () => {
    const customSchema = {
      tags: { type: SchemaFieldTypes.TAG, SEPARATOR: "," },
    };

    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-tag-arrays",
      customSchema,
    });

    const pageContent = faker.lorem.sentence(5);
    await store.addDocuments([
      { pageContent, metadata: { tags: ["javascript", "nodejs"] } },
    ]);

    const results = await store.similaritySearch(pageContent, 1);
    expect(results).toHaveLength(1);

    await store.delete({ deleteAll: true });
  });

  test("handles optional fields", async () => {
    const customSchema = {
      userId: { type: SchemaFieldTypes.TAG, required: true },
      category: { type: SchemaFieldTypes.TAG },
    };

    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: client,
      indexName: "test-optional",
      customSchema,
    });

    const pageContent = faker.lorem.sentence(5);
    await store.addDocuments([
      { pageContent, metadata: { userId: "user123" } },
    ]);

    const results = await store.similaritySearch(pageContent, 1);
    expect(results).toHaveLength(1);
    expect(results[0].metadata.userId).toBe("user123");

    await store.delete({ deleteAll: true });
  });
});
