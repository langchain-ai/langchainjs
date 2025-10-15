/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect, describe } from "vitest";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { SchemaFieldTypes } from "redis";

import {
  RedisVectorStore,
  TagFilter,
  NumericFilter,
  TextFilter,
  GeoFilter,
  TimestampFilter,
  Tag,
  Num,
  Text,
  Geo,
  Timestamp,
} from "../vectorstores.js";

const createRedisClientMockup = () => {
  const hSetMock = vi.fn();
  const expireMock = vi.fn();
  const delMock = vi.fn<any>().mockResolvedValue(1);

  return {
    ft: {
      info: vi.fn<any>().mockResolvedValue({
        numDocs: 0,
      }),
      create: vi.fn(),
      search: vi.fn<any>().mockResolvedValue({
        total: 0,
        documents: [],
      }),
      dropIndex: vi.fn(),
    },
    hSet: hSetMock,
    expire: expireMock,
    del: delMock,
    multi: vi.fn<any>().mockImplementation(() => ({
      exec: vi.fn(),
      hSet: hSetMock,
      expire: expireMock,
    })),
  };
};

test("RedisVectorStore with external keys", async () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();

  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
    filter: "1",
  });

  expect(store).toBeDefined();

  await store.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: {
          a: 1,
          b: { nested: [1, { a: 4 }] },
        },
      },
    ],
    { keys: ["id1"] }
  );

  expect(client.hSet).toHaveBeenCalledTimes(1);
  expect(client.hSet).toHaveBeenCalledWith("id1", {
    content_vector: Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer),
    content: "hello",
    metadata: `{"a":1,"b":{"nested":[1,{"a":4}]}}`,
  });

  const results = await store.similaritySearch("goodbye", 1);

  expect(results).toHaveLength(0);
});

test("RedisVectorStore with generated keys", async () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();

  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
  });

  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

  expect(client.hSet).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("goodbye", 1);

  expect(results).toHaveLength(0);
});

test("RedisVectorStore with TTL", async () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();
  const ttl = 10;
  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
    ttl,
  });

  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

  expect(client.hSet).toHaveBeenCalledTimes(1);
  expect(client.expire).toHaveBeenCalledTimes(1);

  // Verify expire was called with the correct TTL, regardless of the UUID
  const expireCall = (client.expire as any).mock.calls[0];
  expect(expireCall[0]).toMatch(/^doc:documents:/); // Key starts with the expected prefix
  expect(expireCall[1]).toBe(ttl); // TTL value is correct
});

test("RedisVectorStore with filters", async () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();

  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
  });

  expect(store).toBeDefined();

  await store.similaritySearch("hello", 1, ["a", "b", "c"]);

  expect(client.ft.search).toHaveBeenCalledWith(
    "documents",
    "(@metadata: a,b,c) => [KNN 1 @content_vector $vector AS vector_score]",
    {
      PARAMS: {
        vector: Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer),
      },
      RETURN: ["content", "vector_score"],
      SORTBY: "vector_score",
      DIALECT: 2,
      LIMIT: {
        from: 0,
        size: 1,
      },
    }
  );
});

test("RedisVectorStore with raw filter", async () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();

  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
  });

  expect(store).toBeDefined();

  await store.similaritySearch("hello", 1, "a b c");

  expect(client.ft.search).toHaveBeenCalledWith(
    "documents",
    "(@metadata: a b c) => [KNN 1 @content_vector $vector AS vector_score]",
    {
      PARAMS: {
        vector: Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer),
      },
      RETURN: ["content", "vector_score"],
      SORTBY: "vector_score",
      DIALECT: 2,
      LIMIT: {
        from: 0,
        size: 1,
      },
    }
  );
});

describe("RedisVectorStore dropIndex", () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();

  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
  });

  test("without deleteDocuments param provided", async () => {
    await store.dropIndex();

    expect(client.ft.dropIndex).toHaveBeenCalledWith("documents", undefined);
  });

  test("with deleteDocuments as false", async () => {
    await store.dropIndex(false);

    expect(client.ft.dropIndex).toHaveBeenCalledWith("documents", undefined);
  });

  test("with deleteDocument as true", async () => {
    await store.dropIndex(true);

    expect(client.ft.dropIndex).toHaveBeenCalledWith("documents", {
      DD: true,
    });
  });

  test("through delete convenience method", async () => {
    await store.delete({ deleteAll: true });

    expect(client.ft.dropIndex).toHaveBeenCalledWith("documents", {
      DD: true,
    });
  });
});

describe("RedisVectorStore createIndex when index does not exist", () => {
  test("calls ft.create with default create options", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();
    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
    });
    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    await store.createIndex();

    expect(client.ft.create).toHaveBeenCalledWith(
      "documents",
      expect.any(Object),
      {
        ON: "HASH",
        PREFIX: "doc:documents:",
      }
    );
  });

  test("calls ft.create with custom options", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();
    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
      createIndexOptions: {
        ON: "JSON",
        FILTER: '@indexName == "documents"',
        SCORE: 0.5,
        MAXTEXTFIELDS: true,
        TEMPORARY: 1000,
        NOOFFSETS: true,
        NOHL: true,
        NOFIELDS: true,
        NOFREQS: true,
        SKIPINITIALSCAN: true,
        STOPWORDS: ["a", "b"],
        LANGUAGE: "German",
      },
    });
    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    await store.createIndex();

    expect(client.ft.create).toHaveBeenCalledWith(
      "documents",
      expect.any(Object),
      {
        ON: "JSON",
        PREFIX: "doc:documents:",
        FILTER: '@indexName == "documents"',
        SCORE: 0.5,
        MAXTEXTFIELDS: true,
        TEMPORARY: 1000,
        NOOFFSETS: true,
        NOHL: true,
        NOFIELDS: true,
        NOFREQS: true,
        SKIPINITIALSCAN: true,
        STOPWORDS: ["a", "b"],
        LANGUAGE: "German",
      }
    );
  });
});

describe("RedisVectorStore delete", () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();

  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
    keyPrefix: "doc:documents:",
  });

  test("delete documents by ids", async () => {
    const deleteIds = ["doc1", "doc2"];
    await store.delete({ ids: deleteIds });

    expect(client.del).toHaveBeenCalledWith([
      "doc:documents:doc1",
      "doc:documents:doc2",
    ]);
  });

  test("throws error if ids are not provided", async () => {
    await expect(store.delete({ ids: [] })).rejects.toThrow(
      'Invalid parameters passed to "delete".'
    );
  });

  test("throws error if deleteAll is provided as false", async () => {
    await expect(store.delete({ deleteAll: false })).rejects.toThrow(
      'Invalid parameters passed to "delete".'
    );
  });
});

describe("Metadata Schema Tests", () => {
  test("RedisVectorStore with metadata schema", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
      customSchema: [
        { name: "category", type: "tag" },
        { name: "price", type: "numeric" },
        { name: "title", type: "text" },
        { name: "location", type: "geo" },
        { name: "created_at", type: "numeric" }, // Timestamps are stored as numeric fields
      ],
    });

    expect(store).toBeDefined();
    expect(store.customSchema).toHaveLength(5);
  });

  test("Advanced filter with metadata schema", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
      customSchema: [
        { name: "category", type: "tag" },
        { name: "price", type: "numeric" },
      ],
    });

    const complexFilter = Tag("category")
      .eq("electronics")
      .and(Num("price").between(50, 200));

    await store.similaritySearch("test query", 1, complexFilter);

    expect(client.ft.search).toHaveBeenCalledWith(
      "documents",
      "(@category:{electronics} @price:[50 200]) => [KNN 1 @content_vector $vector AS vector_score]",
      expect.objectContaining({
        PARAMS: {
          vector: Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer),
        },
        RETURN: ["content", "vector_score", "category", "price"],
        SORTBY: "vector_score",
        DIALECT: 2,
        LIMIT: {
          from: 0,
          size: 1,
        },
      })
    );
  });

  test("Backward compatibility with legacy filters", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
    });

    // Test legacy array filter
    await store.similaritySearch("test query", 1, ["electronics", "books"]);

    expect(client.ft.search).toHaveBeenCalledWith(
      "documents",
      "(@metadata: electronics,books) => [KNN 1 @content_vector $vector AS vector_score]",
      expect.objectContaining({
        RETURN: ["content", "vector_score"],
      })
    );

    // Test legacy string filter
    await store.similaritySearch("test query", 1, "electronics");

    expect(client.ft.search).toHaveBeenCalledWith(
      "documents",
      "(@metadata: electronics) => [KNN 1 @content_vector $vector AS vector_score]",
      expect.any(Object)
    );
  });

  test("Schema generation with metadata schema and no legacy filter", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
      customSchema: [
        { name: "category", type: "tag" },
        { name: "price", type: "numeric" },
      ],
    });

    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    await store.createIndex();

    // Verify that ft.create was called with the correct schema
    expect(client.ft.create).toHaveBeenCalledWith(
      "documents",
      expect.objectContaining({
        content_vector: expect.any(Object),
        content: expect.any(String),
        // metadata field should NOT be in the schema when using customSchema without legacy filter
        category: expect.any(Object),
        price: expect.any(Object),
      }),
      expect.any(Object)
    );

    // Verify metadata field is NOT in the schema
    const schemaArg = (client.ft.create as any).mock.calls[0][1];
    expect(schemaArg.metadata).toBeUndefined();
  });

  test("Schema generation with metadata schema and legacy string filter", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
      customSchema: [
        { name: "category", type: "tag" },
        { name: "price", type: "numeric" },
      ],
      filter: "electronics", // Legacy string filter
    });

    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    await store.createIndex();

    // Verify that ft.create was called with the correct schema including metadata field
    const schemaArg = (client.ft.create as any).mock.calls[0][1];
    expect(schemaArg.category).toBeDefined();
    expect(schemaArg.price).toBeDefined();
  });

  test("Schema generation with metadata schema and legacy array filter", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
      customSchema: [
        { name: "category", type: "tag" },
        { name: "price", type: "numeric" },
      ],
      filter: ["electronics", "books"], // Legacy array filter
    });

    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    await store.createIndex();

    // Verify that ft.create was called with the correct schema including metadata field
    const schemaArg = (client.ft.create as any).mock.calls[0][1];
    expect(schemaArg.category).toBeDefined();
    expect(schemaArg.price).toBeDefined();
  });

  test("Schema generation without metadata schema includes metadata field", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "documents",
    });

    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    await store.createIndex();

    // Verify that ft.create was called with the correct schema including metadata field
    const schemaArg = (client.ft.create as any).mock.calls[0][1];
    expect(schemaArg.metadata).toBeDefined();
  });

  test("Automatic schema inference from documents", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-auto-infer",
      // No customSchema provided, no legacy filter
    });

    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    const documents = [
      new Document({
        pageContent: "doc1",
        metadata: { category: "tech", price: 99, location: "-122.4, 37.7]" },
      }),
      new Document({
        pageContent: "doc2",
        metadata: { category: "books", price: 15, location: "-118.2, 34.0" },
      }),
      new Document({
        pageContent: "doc3",
        metadata: { category: "tech", price: 50, location: "-73.9, 40.7" },
      }),
      new Document({
        pageContent: "doc4",
        metadata: { category: "tech", price: 75, location: "-0.1, 51.5" },
      }),
      new Document({
        pageContent: "doc5",
        metadata: { category: "books", price: 20, location: "2.3, 48.9" },
      }),
      new Document({
        pageContent: "doc6",
        metadata: { category: "tech", price: 120, location: "139.7, 35.7" },
      }),
    ];

    await store.createIndex(documents, 1536);

    const schemaArg = (client.ft.create as any).mock.calls[0][1];

    // Should NOT include metadata field (using inferred schema instead)
    expect(schemaArg.metadata).toBeUndefined();

    // Should include inferred metadata fields
    expect(schemaArg.category).toBeDefined();
    expect(schemaArg.category.type).toBe(SchemaFieldTypes.TEXT);

    expect(schemaArg.price).toBeDefined();
    expect(schemaArg.price.type).toBe(SchemaFieldTypes.NUMERIC);

    expect(schemaArg.location).toBeDefined();
    expect(schemaArg.location.type).toBe(SchemaFieldTypes.GEO);
  });

  test("Automatic schema inference with legacy filter still includes metadata field", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-auto-infer-legacy",
      filter: "tech", // Legacy string filter
    });

    store.checkIndexState = vi.fn<any>().mockResolvedValue("none");

    const documents = [
      new Document({
        pageContent: "doc1",
        metadata: { category: "tech", price: 99 },
      }),
      new Document({
        pageContent: "doc2",
        metadata: { category: "books", price: 15 },
      }),
    ];

    await store.createIndex(documents, 1536);

    const schemaArg = (client.ft.create as any).mock.calls[0][1];

    // Should include metadata field for legacy compatibility
    expect(schemaArg.metadata).toBeDefined();
    expect(schemaArg.metadata.type).toBe(SchemaFieldTypes.TEXT);

    // Should NOT include inferred fields (legacy mode)
    expect(schemaArg.category).toBeUndefined();
    expect(schemaArg.price).toBeUndefined();
  });
});
