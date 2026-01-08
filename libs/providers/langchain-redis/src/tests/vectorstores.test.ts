/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect, describe } from "vitest";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { SchemaFieldTypes } from "redis";

import {
  RedisVectorStore,
  Tag,
  Num,
  RedisVectorStoreConfig,
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

describe("(LEGACY) RedisVectorStore with Custom Schema", () => {
  const createRedisClientWithCustomSchema = () => {
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
          total: 2,
          documents: [
            {
              value: {
                content_vector: Buffer.from(
                  new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer
                ),
                content: "Test document 1",
                metadata:
                  '{"category":"tech","score":95,"tags":"javascript,nodejs"}',
                "metadata.userId": "user123",
                "metadata.category": "tech",
                "metadata.score": 95,
                "metadata.tags": "javascript,nodejs",
                vector_score: 0.1,
              },
            },
            {
              value: {
                content_vector: Buffer.from(
                  new Float32Array([0.2, 0.3, 0.4, 0.5]).buffer
                ),
                content: "Test document 2",
                metadata:
                  '{"category":"science","score":87,"tags":"python,ai"}',
                "metadata.userId": "user456",
                "metadata.category": "science",
                "metadata.score": 87,
                "metadata.tags": "python,ai",
                vector_score: 0.2,
              },
            },
          ],
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

  test("creates index with custom schema fields", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: RedisVectorStoreConfig["customSchema"] = {
      userId: { type: SchemaFieldTypes.TEXT, required: true, SORTABLE: true },
      category: { type: SchemaFieldTypes.TAG, SORTABLE: true, SEPARATOR: "," },
      score: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
      tags: { type: SchemaFieldTypes.TAG, SEPARATOR: ",", CASESENSITIVE: true },
      description: { type: SchemaFieldTypes.TEXT, NOSTEM: true, WEIGHT: 2.0 },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-custom-schema",
      customSchema,
    });

    await store.createIndex();

    expect(client.ft.create).toHaveBeenCalledWith(
      "test-custom-schema",
      expect.objectContaining({
        content_vector: expect.any(Object),
        content: "TEXT",
        "metadata.userId": {
          type: SchemaFieldTypes.TEXT,
          SORTABLE: true,
        },
        "metadata.category": {
          type: SchemaFieldTypes.TAG,
          // TAG types could not be sortable
          // see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/field-and-type-options/#tag-fields
          // SORTABLE: true,
          SEPARATOR: ",",
        },
        "metadata.score": {
          type: SchemaFieldTypes.NUMERIC,
          SORTABLE: true,
        },
        "metadata.tags": {
          type: SchemaFieldTypes.TAG,
          // TAG types could not be sortable
          // see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/field-and-type-options/#tag-fields
          // SORTABLE: undefined,
          SEPARATOR: ",",
          CASESENSITIVE: true,
        },
        "metadata.description": {
          type: SchemaFieldTypes.TEXT,
          // We are not adding fields unless they have meaningful output for the create command
          // SORTABLE: undefined,
          NOSTEM: true,
          WEIGHT: 2.0,
        },
      }),
      expect.any(Object)
    );
  });

  test("validates metadata against custom schema - success", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: RedisVectorStoreConfig["customSchema"] = {
      userId: { type: SchemaFieldTypes.TEXT, required: true },
      category: { type: SchemaFieldTypes.TAG },
      score: { type: SchemaFieldTypes.NUMERIC },
      tags: { type: SchemaFieldTypes.TAG },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-validation",
      customSchema,
    });

    const validDocument = {
      pageContent: "Valid document",
      metadata: {
        userId: "user123",
        category: "tech",
        score: 95,
        tags: ["javascript", "nodejs"],
      },
    };

    // Should not throw
    await store.addDocuments([validDocument]);
    expect(client.hSet).toHaveBeenCalled();
  });

  test("stores individual metadata fields for indexing", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      userId: { type: SchemaFieldTypes.TEXT },
      category: { type: SchemaFieldTypes.TAG },
      score: { type: SchemaFieldTypes.NUMERIC },
      tags: { type: SchemaFieldTypes.TAG, SEPARATOR: "," },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-indexing",
      customSchema,
    });

    const document = {
      pageContent: "Test document",
      metadata: {
        userId: "user123",
        category: "tech",
        score: 95,
        tags: ["javascript", "nodejs"],
      },
    };

    await store.addDocuments([document], { keys: ["doc1"] });

    expect(client.hSet).toHaveBeenCalledWith("doc1", {
      content_vector: expect.any(Buffer),
      content: "Test document",
      metadata: expect.any(String),
      "metadata.userId": "user123",
      "metadata.category": "tech",
      "metadata.score": 95,
      "metadata.tags": "javascript,nodejs", // Array joined with separator
    });
  });

  test("similaritySearchVectorWithScoreAndMetadata with custom filtering", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: RedisVectorStoreConfig["customSchema"] = {
      userId: { type: SchemaFieldTypes.TEXT },
      category: { type: SchemaFieldTypes.TAG },
      score: { type: SchemaFieldTypes.NUMERIC },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-custom-search",
      customSchema,
    });

    const metadataFilter = {
      category: "tech",
      score: { min: 90, max: 100 },
    };

    const results = await store.similaritySearchVectorWithScoreAndMetadata(
      [0.1, 0.2, 0.3, 0.4],
      2,
      metadataFilter
    );

    expect(client.ft.search).toHaveBeenCalledWith(
      "test-custom-search",
      "(@metadata.category:{tech} @metadata.score:[90 100]) => [KNN 2 @content_vector $vector AS vector_score]",
      {
        PARAMS: {
          vector: expect.any(Buffer),
        },
        RETURN: [
          "metadata",
          "content",
          "vector_score",
          "metadata.userId",
          "metadata.category",
          "metadata.score",
        ],
        SORTBY: "vector_score",
        DIALECT: 2,
        LIMIT: {
          from: 0,
          size: 2,
        },
      }
    );

    expect(results).toHaveLength(2);
    expect(results[0][0].metadata).toEqual({
      category: "tech",
      score: 95,
      userId: "user123",
      tags: "javascript,nodejs",
    });
  });

  test("buildCustomQuery with numeric range filters", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      score: { type: SchemaFieldTypes.NUMERIC },
      price: { type: SchemaFieldTypes.NUMERIC },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-numeric-filters",
      customSchema,
    });

    // Test different numeric filter formats
    const [query1] = store.buildCustomQuery([0.1, 0.2, 0.3, 0.4], 5, {
      score: { min: 80, max: 100 },
      price: { min: 50 }, // Only minimum
    });

    expect(query1).toBe(
      "@metadata.score:[80 100] @metadata.price:[50 +inf] => [KNN 5 @content_vector $vector AS vector_score]"
    );

    // Test exact numeric match
    const [query2] = store.buildCustomQuery([0.1, 0.2, 0.3, 0.4], 5, {
      score: 95, // Exact match
    });

    expect(query2).toBe(
      "@metadata.score:[95 95] => [KNN 5 @content_vector $vector AS vector_score]"
    );
  });

  test("buildCustomQuery with tag filters", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      category: { type: SchemaFieldTypes.TAG },
      tags: { type: SchemaFieldTypes.TAG },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-tag-filters",
      customSchema,
    });

    // Test single tag
    const [query1] = store.buildCustomQuery([0.1, 0.2, 0.3, 0.4], 5, {
      category: "tech",
    });

    expect(query1).toBe(
      "@metadata.category:{tech} => [KNN 5 @content_vector $vector AS vector_score]"
    );

    // Test multiple tags (OR operation)
    const [query2] = store.buildCustomQuery([0.1, 0.2, 0.3, 0.4], 5, {
      category: ["tech", "science"],
    });

    expect(query2).toBe(
      "@metadata.category:({tech}|{science}) => [KNN 5 @content_vector $vector AS vector_score]"
    );
  });

  test("buildCustomQuery with text filters", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      title: { type: SchemaFieldTypes.TEXT },
      description: { type: SchemaFieldTypes.TEXT },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-text-filters",
      customSchema,
    });

    const [query] = store.buildCustomQuery([0.1, 0.2, 0.3, 0.4], 5, {
      title: "javascript tutorial",
    });

    expect(query).toBe(
      "@metadata.title:(javascript tutorial) => [KNN 5 @content_vector $vector AS vector_score]"
    );
  });

  test("buildCustomQuery with mixed filter types", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      category: { type: SchemaFieldTypes.TAG },
      score: { type: SchemaFieldTypes.NUMERIC },
      title: { type: SchemaFieldTypes.TEXT },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-mixed-filters",
      customSchema,
    });

    const [query] = store.buildCustomQuery([0.1, 0.2, 0.3, 0.4], 5, {
      category: "tech",
      score: { min: 90 },
      title: "javascript",
    });

    expect(query).toBe(
      "@metadata.category:{tech} @metadata.score:[90 +inf] @metadata.title:(javascript) => [KNN 5 @content_vector $vector AS vector_score]"
    );
  });

  test("includes custom schema fields in search return fields", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      userId: { type: SchemaFieldTypes.TEXT },
      category: { type: SchemaFieldTypes.TAG },
      score: { type: SchemaFieldTypes.NUMERIC },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-return-fields",
      customSchema,
    });

    await store.similaritySearch("test query", 2);

    expect(client.ft.search).toHaveBeenCalledWith(
      "test-return-fields",
      expect.any(String),
      expect.objectContaining({
        RETURN: [
          "metadata",
          "content",
          "vector_score",
          "metadata.userId",
          "metadata.category",
          "metadata.score",
        ],
      })
    );
  });

  test("handles optional metadata fields correctly", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      userId: { type: SchemaFieldTypes.TEXT, required: true },
      category: { type: SchemaFieldTypes.TAG, required: false }, // Optional
      score: { type: SchemaFieldTypes.NUMERIC }, // Optional (default)
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-optional-fields",
      customSchema,
    });

    const documentWithPartialMetadata = {
      pageContent: "Test document",
      metadata: {
        userId: "user123",
        // category and score are optional and not provided
      },
    };

    // Should not throw for missing optional fields
    await store.addDocuments([documentWithPartialMetadata]);
    expect(client.hSet).toHaveBeenCalled();
  });

  test("ignores unknown schema fields in metadata filter", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: any = {
      category: { type: SchemaFieldTypes.TAG },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-unknown-fields",
      customSchema,
    });

    const [query] = store.buildCustomQuery([0.1, 0.2, 0.3, 0.4], 5, {
      category: "tech",
      unknownField: "ignored", // This should be ignored
    });

    // Should only include the known schema field
    expect(query).toBe(
      "@metadata.category:{tech} => [KNN 5 @content_vector $vector AS vector_score]"
    );
  });

  test("works without custom schema (backward compatibility)", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-no-schema",
      // No customSchema provided
    });

    const document = {
      pageContent: "Test document",
      metadata: { any: "field" },
    };

    // Should work normally without custom schema
    await store.addDocuments([document]);
    expect(client.hSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        content: "Test document",
        metadata: expect.any(String),
        // Should not have individual metadata fields
      })
    );

    // Should not include custom schema fields in return
    await store.similaritySearch("test", 1);
    expect(client.ft.search).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        RETURN: ["metadata", "content", "vector_score"], // No custom fields
      })
    );
  });

  test("similaritySearchVectorWithScoreAndMetadata with metadataFilter parameter", async () => {
    const client = createRedisClientMockup();
    const embeddings = new FakeEmbeddings();

    const customSchema: RedisVectorStore["customSchema"] = [
      { name: "userId", type: "text" },
      { name: "category", type: "tag" },
      { name: "score", type: "numeric" },
    ];

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-custom-search",
      customSchema,
    });

    // Mock the search response
    (client.ft.search as any).mockResolvedValue({
      total: 1,
      documents: [
        {
          value: {
            content: "test content 1",
            vector_score: 0.95,
            userId: "user123",
            category: "tech",
            score: 95,
          },
        },
      ],
    });

    // Call with metadataFilter parameter
    const results = await store.similaritySearchVectorWithScoreAndMetadata(
      [0.1, 0.2, 0.3, 0.4],
      2,
      { category: "tech", score: 95 }
    );

    expect(results).toHaveLength(1);
    expect(results[0][0].pageContent).toBe("test content 1");
    expect(results[0][1]).toBe(0.95);

    // Verify that the filter was applied in the search call
    const searchCall = (client.ft.search as any).mock.calls[0];
    const queryString = searchCall[1];
    // The query should contain filter conditions for category and score with metadata prefix
    expect(queryString).toContain("@metadata.category");
    expect(queryString).toContain("@metadata.score");
  });
});

describe("RedisVectorStore backward compatibility", () => {
  test("accepts legacy customSchema format and converts it", async () => {
    const client = createRedisClientMockup();
    (client.ft.info as any).mockRejectedValue(new Error("Unknown Index name"));

    const embeddings = new FakeEmbeddings();

    // Use legacy format
    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-legacy-schema",
      customSchema: {
        category: { type: SchemaFieldTypes.TAG, SEPARATOR: "|" },
        price: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
        description: { type: SchemaFieldTypes.TEXT, WEIGHT: 2.0 },
      },
    });

    // Verify that customSchema was converted to new format
    expect(store.customSchema).toBeDefined();
    expect(Array.isArray(store.customSchema)).toBe(true);
    expect(store.customSchema).toHaveLength(3);

    // Check that fields were converted correctly
    const categoryField = store.customSchema?.find((f) => f.name === "category");
    expect(categoryField).toEqual({
      name: "category",
      type: "tag",
      options: { separator: "|" },
    });

    const priceField = store.customSchema?.find((f) => f.name === "price");
    expect(priceField).toEqual({
      name: "price",
      type: "numeric",
      options: { sortable: true },
    });

    const descriptionField = store.customSchema?.find(
      (f) => f.name === "description"
    );
    expect(descriptionField).toEqual({
      name: "description",
      type: "text",
      options: { weight: 2.0 },
    });
  });

  test("accepts new customSchema format without conversion", async () => {
    const client = createRedisClientMockup();
    (client.ft.info as any).mockRejectedValue(new Error("Unknown Index name"));

    const embeddings = new FakeEmbeddings();

    // Use new format
    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-new-schema",
      customSchema: [
        { name: "category", type: "tag", options: { separator: "|" } },
        { name: "price", type: "numeric", options: { sortable: true } },
      ],
    });

    // Verify that customSchema is used as-is
    expect(store.customSchema).toBeDefined();
    expect(Array.isArray(store.customSchema)).toBe(true);
    expect(store.customSchema).toHaveLength(2);
    expect(store.customSchema).toEqual([
      { name: "category", type: "tag", options: { separator: "|" } },
      { name: "price", type: "numeric", options: { sortable: true } },
    ]);
  });

  test("legacy format creates correct Redis schema", async () => {
    const client = createRedisClientMockup();
    (client.ft.info as any).mockRejectedValue(new Error("Unknown Index name"));

    const embeddings = new FakeEmbeddings();

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-legacy-redis-schema",
      customSchema: {
        userId: { type: SchemaFieldTypes.TAG },
        score: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
      },
    });

    const documents = [
      new Document({
        pageContent: "test",
        metadata: { userId: "user1", score: 100 },
      }),
    ];

    await store.createIndex(documents, 1536);

    const schemaArg = (client.ft.create as any).mock.calls[0][1];

    // Should include converted fields
    expect(schemaArg.userId).toBeDefined();
    expect(schemaArg.userId.type).toBe(SchemaFieldTypes.TAG);

    expect(schemaArg.score).toBeDefined();
    expect(schemaArg.score.type).toBe(SchemaFieldTypes.NUMERIC);
    expect(schemaArg.score.SORTABLE).toBe(true);
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
});
