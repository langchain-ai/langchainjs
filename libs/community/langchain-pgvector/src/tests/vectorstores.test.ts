import { describe, expect, test, vi, beforeEach } from "vitest";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { PGVectorStore } from "../vectorstores.js";
import type { PGVectorStoreArgs } from "../vectorstores.js";

class MockEmbeddings implements EmbeddingsInterface {
  embedQuery(_text: string): Promise<number[]> {
    return Promise.resolve([0.1, 0.2, 0.3, 0.4]);
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(() => [0.1, 0.2, 0.3, 0.4]));
  }
}

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue({
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function createStore(
  overrides: Partial<PGVectorStoreArgs> = {}
): PGVectorStore {
  const pool = createMockPool();
  return new PGVectorStore(new MockEmbeddings(), {
    tableName: "test_table",
    pool,
    ...overrides,
  });
}

describe("PGVectorStore", () => {
  describe("constructor", () => {
    test("initializes with required pool config", () => {
      const store = createStore();
      expect(store).toBeDefined();
      expect(store.tableName).toBe("test_table");
    });

    test("initializes with postgresConnectionOptions", () => {
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        postgresConnectionOptions: {
          host: "localhost",
          port: 5432,
          user: "test",
          password: "test",
          database: "test",
        },
      });
      expect(store).toBeDefined();
      expect(store.tableName).toBe("test_table");
    });

    test("throws without connection config", () => {
      expect(
        () =>
          new PGVectorStore(new MockEmbeddings(), {
            tableName: "test_table",
          } as PGVectorStoreArgs)
      ).toThrow(
        "You must provide either a `postgresConnectionOptions` object or a `pool` instance."
      );
    });

    test("throws when collectionName is set without collectionTableName", () => {
      expect(() =>
        createStore({
          collectionName: "my_collection",
        })
      ).toThrow(
        `If supplying a "collectionName", you must also supply a "collectionTableName".`
      );
    });

    test("uses default column names", () => {
      const store = createStore();
      expect(store.idColumnName).toBe("id");
      expect(store.vectorColumnName).toBe("embedding");
      expect(store.contentColumnName).toBe("text");
      expect(store.metadataColumnName).toBe("metadata");
    });

    test("uses custom column names", () => {
      const store = createStore({
        columns: {
          idColumnName: "custom_id",
          vectorColumnName: "custom_vector",
          contentColumnName: "custom_content",
          metadataColumnName: "custom_metadata",
        },
      });
      expect(store.idColumnName).toBe("custom_id");
      expect(store.vectorColumnName).toBe("custom_vector");
      expect(store.contentColumnName).toBe("custom_content");
      expect(store.metadataColumnName).toBe("custom_metadata");
    });

    test("sets default values", () => {
      const store = createStore();
      expect(store.collectionName).toBe("langchain");
      expect(store.collectionMetadata).toBeNull();
      expect(store.schemaName).toBeNull();
      expect(store.extensionSchemaName).toBeNull();
      expect(store.skipInitializationCheck).toBe(false);
      expect(store.chunkSize).toBe(500);
      expect(store.distanceStrategy).toBe("cosine");
      expect(store.scoreNormalization).toBe("distance");
    });

    test("accepts custom chunkSize", () => {
      const store = createStore({ chunkSize: 100 });
      expect(store.chunkSize).toBe(100);
    });

    test("accepts custom distanceStrategy", () => {
      const store = createStore({ distanceStrategy: "euclidean" });
      expect(store.distanceStrategy).toBe("euclidean");
    });

    test("accepts collection config", () => {
      const store = createStore({
        collectionName: "test_collection",
        collectionTableName: "collections",
        collectionMetadata: { key: "value" },
      });
      expect(store.collectionName).toBe("test_collection");
      expect(store.collectionTableName).toBe("collections");
      expect(store.collectionMetadata).toEqual({ key: "value" });
    });

    test("accepts schema config", () => {
      const store = createStore({
        schemaName: "my_schema",
        extensionSchemaName: "ext_schema",
      });
      expect(store.schemaName).toBe("my_schema");
      expect(store.extensionSchemaName).toBe("ext_schema");
    });
  });

  describe("_vectorstoreType", () => {
    test("returns pgvector", () => {
      const store = createStore();
      expect(store._vectorstoreType()).toBe("pgvector");
    });
  });

  describe("computedTableName", () => {
    test("returns plain table name without schema", () => {
      const store = createStore();
      expect(store.computedTableName).toBe("test_table");
    });

    test("returns schema-qualified table name", () => {
      const store = createStore({ schemaName: "my_schema" });
      expect(store.computedTableName).toBe('"my_schema"."test_table"');
    });
  });

  describe("computedCollectionTableName", () => {
    test("returns plain collection table name without schema", () => {
      const store = createStore({
        collectionTableName: "collections",
        collectionName: "test",
      });
      expect(store.computedCollectionTableName).toBe("collections");
    });

    test("returns schema-qualified collection table name", () => {
      const store = createStore({
        schemaName: "my_schema",
        collectionTableName: "collections",
        collectionName: "test",
      });
      expect(store.computedCollectionTableName).toBe(
        '"my_schema"."collections"'
      );
    });
  });

  describe("computedOperatorString", () => {
    test("returns cosine operator by default", () => {
      const store = createStore();
      expect(store.computedOperatorString).toBe("<=>");
    });

    test("returns inner product operator", () => {
      const store = createStore({ distanceStrategy: "innerProduct" });
      expect(store.computedOperatorString).toBe("<#>");
    });

    test("returns euclidean operator", () => {
      const store = createStore({ distanceStrategy: "euclidean" });
      expect(store.computedOperatorString).toBe("<->");
    });

    test("returns operator with extension schema", () => {
      const store = createStore({ extensionSchemaName: "ext" });
      expect(store.computedOperatorString).toBe("OPERATOR(ext.<=>)");
    });

    test("throws for unknown distance strategy", () => {
      const store = createStore();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.distanceStrategy = "unknown" as any;
      expect(() => store.computedOperatorString).toThrow(
        "Unknown distance strategy: unknown"
      );
    });
  });

  describe("addDocuments", () => {
    test("embeds and inserts documents", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.addDocuments([
        new Document({ pageContent: "hello", metadata: { key: "val" } }),
      ]);

      expect(pool.query).toHaveBeenCalled();
      const lastCall = pool.query.mock.calls[pool.query.mock.calls.length - 1];
      expect(lastCall[0]).toContain("INSERT INTO");
      expect(lastCall[0]).toContain("test_table");
    });

    test("embeds and inserts documents with ids", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.addDocuments(
        [new Document({ pageContent: "hello", metadata: {} })],
        { ids: ["test-id-1"] }
      );

      expect(pool.query).toHaveBeenCalled();
      const lastCall = pool.query.mock.calls[pool.query.mock.calls.length - 1];
      expect(lastCall[1]).toContain("test-id-1");
    });
  });

  describe("addVectors", () => {
    test("throws when ids length doesn't match vectors", async () => {
      const store = createStore();
      await expect(
        store.addVectors(
          [[0.1, 0.2]],
          [new Document({ pageContent: "a", metadata: {} })],
          { ids: ["1", "2"] }
        )
      ).rejects.toThrow(
        "The number of ids must match the number of vectors provided."
      );
    });

    test("strips null bytes from content and embeddings", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.addVectors(
        [[0.1, 0.2]],
        [new Document({ pageContent: "hello\0world", metadata: {} })]
      );

      const lastCall = pool.query.mock.calls[pool.query.mock.calls.length - 1];
      expect(lastCall[1][0]).toBe("helloworld");
    });

    test("chunks large batches", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        chunkSize: 2,
      });

      const docs = Array.from(
        { length: 5 },
        (_, i) => new Document({ pageContent: `doc${i}`, metadata: {} })
      );
      const vectors = Array.from({ length: 5 }, () => [0.1, 0.2]);

      await store.addVectors(vectors, docs);

      const insertCalls = pool.query.mock.calls.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any) => typeof call[0] === "string" && call[0].includes("INSERT")
      );
      expect(insertCalls.length).toBe(3);
    });

    test("wraps insertion errors", async () => {
      const pool = createMockPool();
      pool.query.mockRejectedValueOnce(new Error("connection refused"));
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await expect(
        store.addVectors(
          [[0.1]],
          [new Document({ pageContent: "test", metadata: {} })]
        )
      ).rejects.toThrow("Error inserting: connection refused");
    });
  });

  describe("delete", () => {
    test("throws when neither ids nor filter provided", async () => {
      const store = createStore();
      await expect(store.delete({})).rejects.toThrow(
        "You must specify either ids or a filter when deleting documents."
      );
    });

    test("throws when both ids and filter provided", async () => {
      const store = createStore();
      await expect(
        store.delete({ ids: ["1"], filter: { key: "value" } })
      ).rejects.toThrow(
        "You cannot specify both ids and a filter when deleting documents."
      );
    });

    test("deletes by ids", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.delete({ ids: ["id1", "id2"] });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM"),
        expect.arrayContaining([["id1", "id2"]])
      );
    });

    test("deletes by filter", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.delete({ filter: { category: "test" } });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM"),
        expect.arrayContaining(["test"])
      );
    });
  });

  describe("similaritySearchVectorWithScore", () => {
    test("queries postgres and returns results", async () => {
      const pool = createMockPool();
      pool.query.mockResolvedValue({
        rows: [
          {
            id: "uuid-1",
            text: "hello world",
            metadata: { key: "value" },
            embedding: "[0.1,0.2,0.3]",
            _distance: 0.1,
          },
        ],
      });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      const results = await store.similaritySearchVectorWithScore(
        [0.1, 0.2, 0.3],
        5
      );

      expect(results).toHaveLength(1);
      expect(results[0][0].pageContent).toBe("hello world");
      expect(results[0][0].metadata).toEqual({ key: "value" });
      expect(results[0][0].id).toBe("uuid-1");
      expect(results[0][1]).toBe(0.1);
    });

    test("applies metadata filter", async () => {
      const pool = createMockPool();
      pool.query.mockResolvedValue({ rows: [] });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.similaritySearchVectorWithScore([0.1, 0.2], 5, {
        category: "test",
      });

      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("metadata->>'category'");
      expect(queryCall[1]).toContain("test");
    });

    test("skips rows with null distance or content", async () => {
      const pool = createMockPool();
      pool.query.mockResolvedValue({
        rows: [
          { id: "1", text: null, metadata: {}, _distance: 0.1 },
          { id: "2", text: "valid", metadata: {}, _distance: null },
          { id: "3", text: "valid", metadata: {}, _distance: 0.2 },
        ],
      });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      const results = await store.similaritySearchVectorWithScore([0.1], 10);

      expect(results).toHaveLength(1);
      expect(results[0][0].pageContent).toBe("valid");
    });
  });

  describe("filter operators", () => {
    let pool: ReturnType<typeof createMockPool>;
    let store: PGVectorStore;

    beforeEach(() => {
      pool = createMockPool();
      pool.query.mockResolvedValue({ rows: [] });
      store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });
    });

    test("handles 'in' operator", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: { in: ["a", "b", "c"] },
      });
      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("IN");
      expect(queryCall[1]).toContain("a");
      expect(queryCall[1]).toContain("b");
      expect(queryCall[1]).toContain("c");
    });

    test("handles 'notIn' operator", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: { notIn: ["x", "y"] },
      });
      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("NOT IN");
    });

    test("handles 'arrayContains' operator", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        tags: { arrayContains: ["tag1", "tag2"] },
      });
      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("?| array[");
    });

    test("handles numeric comparison operators", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        score: { gt: 10, gte: 5, lt: 100, lte: 50 },
      });
      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("::numeric >");
      expect(queryCall[0]).toContain("::numeric >=");
      expect(queryCall[0]).toContain("::numeric <");
      expect(queryCall[0]).toContain("::numeric <=");
    });

    test("handles 'neq' operator", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        status: { neq: "deleted" },
      });
      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("IS NULL OR");
      expect(queryCall[0]).toContain("!= $");
    });

    test("handles simple equality filter", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: "test",
      });
      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("metadata->>'category' = $");
    });

    test("handles mixed equality and operator filters", async () => {
      await store.similaritySearchVectorWithScore([0.1], 5, {
        category: "test",
        score: { gte: 80 },
      });
      const queryCall = pool.query.mock.calls[0];
      expect(queryCall[0]).toContain("metadata->>'category' = $");
      expect(queryCall[0]).toContain("::numeric >=");
    });
  });

  describe("score normalization", () => {
    test("returns raw distance when scoreNormalization is 'distance'", () => {
      const store = createStore({ scoreNormalization: "distance" });
      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(0.3)).toBe(0.3);
    });

    test("converts cosine distance to similarity", () => {
      const store = createStore({
        scoreNormalization: "similarity",
        distanceStrategy: "cosine",
      });

      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(0)).toBe(1);
      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(1)).toBe(0.5);
      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(2)).toBe(0);
    });

    test("converts euclidean distance to similarity", () => {
      const store = createStore({
        scoreNormalization: "similarity",
        distanceStrategy: "euclidean",
      });

      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(0)).toBe(1);
      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(1)).toBe(0.5);
      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(9)).toBe(0.1);
    });

    test("converts inner product distance to similarity", () => {
      const store = createStore({
        scoreNormalization: "similarity",
        distanceStrategy: "innerProduct",
      });

      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(0)).toBeCloseTo(0);
      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(-1)).toBe(1);
      // @ts-expect-error - accessing private method
      expect(store.convertDistanceToScore(-5)).toBe(5);
    });

    test("scoreNormalization defaults to 'distance'", () => {
      const store = createStore();
      expect(store.scoreNormalization).toBe("distance");
    });

    test("scoreNormalization can be set to 'similarity'", () => {
      const store = createStore({ scoreNormalization: "similarity" });
      expect(store.scoreNormalization).toBe("similarity");
    });
  });

  describe("similaritySearchVectorWithScores (dual scores)", () => {
    test("returns both distance and similarity", async () => {
      const pool = createMockPool();
      pool.query.mockResolvedValue({
        rows: [
          {
            id: "uuid-1",
            text: "hello",
            metadata: {},
            embedding: "[0.1,0.2]",
            _distance: 0.2,
          },
        ],
      });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        distanceStrategy: "cosine",
      });

      const results = await store.similaritySearchVectorWithScores(
        [0.1, 0.2],
        5
      );

      expect(results).toHaveLength(1);
      expect(results[0][1].distance).toBe(0.2);
      expect(results[0][1].similarity).toBe((2 - 0.2) / 2);
    });
  });

  describe("end", () => {
    test("releases client and ends pool", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      const mockClient = { release: vi.fn() };
      store.client = mockClient as ReturnType<typeof createMockPool>;

      await store.end();

      expect(mockClient.release).toHaveBeenCalled();
      expect(pool.end).toHaveBeenCalled();
    });
  });

  describe("ensureTableInDatabase", () => {
    test("creates extension and table", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.ensureTableInDatabase();

      expect(pool.query).toHaveBeenCalledWith(
        "CREATE EXTENSION IF NOT EXISTS vector;"
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS")
      );
    });

    test("creates extension with custom schema", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        extensionSchemaName: "ext",
      });

      await store.ensureTableInDatabase();

      expect(pool.query).toHaveBeenCalledWith(
        `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA "ext";`
      );
    });

    test("creates table with specified dimensions", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.ensureTableInDatabase(1536);

      const tableCall = pool.query.mock.calls[1];
      expect(tableCall[0]).toContain("vector(1536)");
    });

    test("skips when skipInitializationCheck is true", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        skipInitializationCheck: true,
      });

      await store.ensureTableInDatabase();

      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe("ensureCollectionTableInDatabase", () => {
    test("creates collection table and index", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      await store.ensureCollectionTableInDatabase();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS collections")
      );
    });

    test("skips when skipInitializationCheck is true", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
        skipInitializationCheck: true,
      });

      await store.ensureCollectionTableInDatabase();

      expect(pool.query).not.toHaveBeenCalled();
    });

    test("silently handles 'already exists' errors", async () => {
      const pool = createMockPool();
      pool.query.mockRejectedValueOnce(
        new Error("column already exists in table")
      );
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      await expect(
        store.ensureCollectionTableInDatabase()
      ).resolves.toBeUndefined();
    });

    test("rethrows non-'already exists' errors", async () => {
      const pool = createMockPool();
      pool.query.mockRejectedValueOnce(new Error("connection refused"));
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      await expect(store.ensureCollectionTableInDatabase()).rejects.toThrow(
        "Error adding column or creating index"
      );
    });
  });

  describe("getOrCreateCollection", () => {
    test("returns existing collection id", async () => {
      const pool = createMockPool();
      pool.query.mockResolvedValueOnce({
        rows: [{ uuid: "existing-uuid" }],
      });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      const result = await store.getOrCreateCollection();
      expect(result).toBe("existing-uuid");
    });

    test("creates new collection when not found", async () => {
      const pool = createMockPool();
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ uuid: "new-uuid" }] });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      const result = await store.getOrCreateCollection();
      expect(result).toBe("new-uuid");
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe("createHnswIndex", () => {
    test("creates HNSW index with cosine distance", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        distanceStrategy: "cosine",
      });

      await store.createHnswIndex({ dimensions: 1536 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("vector_cosine_ops")
      );
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("hnsw"));
    });

    test("creates HNSW index with inner product distance", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        distanceStrategy: "innerProduct",
      });

      await store.createHnswIndex({ dimensions: 1536 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("vector_ip_ops")
      );
    });

    test("creates HNSW index with euclidean distance", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        distanceStrategy: "euclidean",
      });

      await store.createHnswIndex({ dimensions: 1536 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("vector_l2_ops")
      );
    });

    test("creates HNSW index with custom m and efConstruction", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.createHnswIndex({
        dimensions: 1536,
        m: 32,
        efConstruction: 128,
      });

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("m=32"));
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("ef_construction=128")
      );
    });

    test("creates HNSW index with namespace prefix", async () => {
      const pool = createMockPool();
      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.createHnswIndex({
        dimensions: 1536,
        namespace: "my_ns",
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("my_ns_")
      );
    });

    test("handles query errors gracefully", async () => {
      const pool = createMockPool();
      pool.query.mockRejectedValueOnce(new Error("index error"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      await store.createHnswIndex({ dimensions: 1536 });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("collection-aware operations", () => {
    test("includes collection_id in search queries", async () => {
      const pool = createMockPool();
      pool.query
        .mockResolvedValueOnce({ rows: [{ uuid: "collection-uuid" }] })
        .mockResolvedValueOnce({ rows: [] });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      await store.similaritySearchVectorWithScore([0.1], 5);

      const searchCall = pool.query.mock.calls[1];
      expect(searchCall[0]).toContain("collection_id = $3");
    });

    test("includes collection_id in delete queries", async () => {
      const pool = createMockPool();
      pool.query.mockResolvedValueOnce({
        rows: [{ uuid: "collection-uuid" }],
      });

      const store = new PGVectorStore(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      await store.delete({ ids: ["id1"] });

      const deleteCall = pool.query.mock.calls[1];
      expect(deleteCall[0]).toContain("collection_id = $2");
    });
  });

  describe("initialize", () => {
    test("creates instance and initializes database", async () => {
      const pool = createMockPool();

      const store = await PGVectorStore.initialize(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
      });

      expect(store).toBeInstanceOf(PGVectorStore);
      expect(pool.connect).toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledWith(
        "CREATE EXTENSION IF NOT EXISTS vector;"
      );
    });

    test("initializes with dimensions", async () => {
      const pool = createMockPool();

      await PGVectorStore.initialize(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        dimensions: 1536,
      });

      const tableCall = pool.query.mock.calls[1];
      expect(tableCall[0]).toContain("vector(1536)");
    });

    test("initializes with collection table", async () => {
      const pool = createMockPool();

      await PGVectorStore.initialize(new MockEmbeddings(), {
        tableName: "test_table",
        pool,
        collectionTableName: "collections",
        collectionName: "test",
      });

      const calls = pool.query.mock.calls.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c[0]
      );
      expect(
        calls.some((c: string) =>
          c.includes("CREATE TABLE IF NOT EXISTS collections")
        )
      ).toBe(true);
    });
  });
});
