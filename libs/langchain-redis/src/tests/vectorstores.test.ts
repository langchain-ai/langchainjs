/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect, describe } from "@jest/globals";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { SchemaFieldTypes } from "redis";

import { RedisVectorStore, RedisVectorStoreConfig } from "../vectorstores.js";

const createRedisClientMockup = () => {
  const hSetMock = jest.fn();
  const expireMock = jest.fn();
  const delMock = jest.fn<any>().mockResolvedValue(1);

  return {
    ft: {
      info: jest.fn<any>().mockResolvedValue({
        numDocs: 0,
      }),
      create: jest.fn(),
      search: jest.fn<any>().mockResolvedValue({
        total: 0,
        documents: [],
      }),
      dropIndex: jest.fn(),
    },
    hSet: hSetMock,
    expire: expireMock,
    del: delMock,
    multi: jest.fn<any>().mockImplementation(() => ({
      exec: jest.fn(),
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
    metadata: `{\\"a\\"\\:1,\\"b\\"\\:{\\"nested\\"\\:[1,{\\"a\\"\\:4}]}}`,
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
  expect(client.expire).toHaveBeenCalledWith("doc:documents:0", ttl);
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
    "@metadata:(a|b|c) => [KNN 1 @content_vector $vector AS vector_score]",
    {
      PARAMS: {
        vector: Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer),
      },
      RETURN: ["metadata", "content", "vector_score"],
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
    "@metadata:(a b c) => [KNN 1 @content_vector $vector AS vector_score]",
    {
      PARAMS: {
        vector: Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer),
      },
      RETURN: ["metadata", "content", "vector_score"],
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
    store.checkIndexExists = jest.fn<any>().mockResolvedValue(false);

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
    store.checkIndexExists = jest.fn<any>().mockResolvedValue(false);

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

describe("RedisVectorStore with Custom Schema", () => {
  const createRedisClientWithCustomSchema = () => {
    const hSetMock = jest.fn();
    const expireMock = jest.fn();
    const delMock = jest.fn<any>().mockResolvedValue(1);

    return {
      ft: {
        info: jest.fn<any>().mockResolvedValue({
          numDocs: 0,
        }),
        create: jest.fn(),
        search: jest.fn<any>().mockResolvedValue({
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
        dropIndex: jest.fn(),
      },
      hSet: hSetMock,
      expire: expireMock,
      del: delMock,
      multi: jest.fn<any>().mockImplementation(() => ({
        exec: jest.fn(),
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

    store.checkIndexExists = jest.fn<any>().mockResolvedValue(false);
    await store.createIndex();

    expect(client.ft.create).toHaveBeenCalledWith(
      "test-custom-schema",
      expect.objectContaining({
        content_vector: expect.any(Object),
        content: "TEXT",
        metadata: "TEXT",
        "metadata.userId": {
          type: SchemaFieldTypes.TEXT,
          SORTABLE: true,
        },
        "metadata.category": {
          type: SchemaFieldTypes.TAG,
          SORTABLE: true,
          SEPARATOR: ",",
        },
        "metadata.score": {
          type: SchemaFieldTypes.NUMERIC,
          SORTABLE: true,
        },
        "metadata.tags": {
          type: SchemaFieldTypes.TAG,
          SORTABLE: undefined,
          SEPARATOR: ",",
        },
        "metadata.description": {
          type: SchemaFieldTypes.TEXT,
          SORTABLE: undefined,
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

  test("validates metadata against custom schema - missing required field", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: RedisVectorStoreConfig["customSchema"] = {
      userId: { type: SchemaFieldTypes.TEXT, required: true },
      category: { type: SchemaFieldTypes.TAG },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-validation-error",
      customSchema,
    });

    const invalidDocument = {
      pageContent: "Invalid document",
      metadata: {
        category: "tech",
        // Missing required userId
      },
    };

    await expect(store.addDocuments([invalidDocument])).rejects.toThrow(
      "Required metadata field 'userId' is missing"
    );
  });

  test("validates metadata against custom schema - wrong type", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: RedisVectorStoreConfig["customSchema"] = {
      score: { type: SchemaFieldTypes.NUMERIC, required: true },
    };

    const store = new RedisVectorStore(embeddings, {
      redisClient: client as any,
      indexName: "test-type-validation",
      customSchema,
    });

    const invalidDocument = {
      pageContent: "Invalid document",
      metadata: {
        score: "not-a-number", // Should be number
      },
    };

    await expect(store.addDocuments([invalidDocument])).rejects.toThrow(
      "Metadata field 'score' must be a number, got string"
    );
  });

  test("stores individual metadata fields for indexing", async () => {
    const client = createRedisClientWithCustomSchema();
    const embeddings = new FakeEmbeddings();

    const customSchema: RedisVectorStoreConfig["customSchema"] = {
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
      "@metadata.category:{tech} @metadata.score:[90 100] => [KNN 2 @content_vector $vector AS vector_score]",
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

    const customSchema = {
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

    const customSchema = {
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

    const customSchema = {
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

    const customSchema = {
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

    const customSchema = {
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

    const customSchema = {
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

    const customSchema = {
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
});
