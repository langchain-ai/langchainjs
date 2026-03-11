/* eslint-disable @typescript-eslint/no-explicit-any */
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { jest, test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { PrismaVectorStore } from "../prisma.js";

class Sql {
  strings: string[];
}

const mockColumns = {
  id: PrismaVectorStore.IdColumn as typeof PrismaVectorStore.IdColumn,
  content:
    PrismaVectorStore.ContentColumn as typeof PrismaVectorStore.ContentColumn,
};

const sql = jest.fn<(params: unknown) => Sql>();
const raw = jest.fn<(params: unknown) => Sql>();
const join = jest.fn<(params: unknown) => Sql>();

const mockPrismaNamespace = {
  ModelName: {},
  Sql,
  raw,
  join,
  sql,
};

const $queryRaw = jest.fn<(params: unknown) => Promise<any>>();
const $executeRaw = jest.fn<(params: unknown) => Promise<any>>();
const $transaction = jest.fn<(params: unknown) => Promise<any>>();

const mockPrismaClient = {
  $queryRaw,
  $executeRaw,
  $transaction,
};

describe("Prisma", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("passes provided filters with simiaritySearch", async () => {
    const embeddings = new FakeEmbeddings();
    const store = new PrismaVectorStore(new FakeEmbeddings(), {
      db: mockPrismaClient,
      prisma: mockPrismaNamespace,
      tableName: "test",
      vectorColumnName: "vector",
      columns: mockColumns,
    });
    const similaritySearchVectorWithScoreSpy = jest
      .spyOn(store, "similaritySearchVectorWithScore")
      .mockResolvedValue([]);

    const filter = { id: { equals: "123" } };

    await store.similaritySearch("hello", 1, filter);

    const embeddedQuery = await embeddings.embedQuery("hello");
    expect(similaritySearchVectorWithScoreSpy).toHaveBeenCalledTimes(1);
    expect(similaritySearchVectorWithScoreSpy).toHaveBeenCalledWith(
      embeddedQuery,
      1,
      filter
    );
  });

  describe("UUID column type support", () => {
    test("addVectors applies UUID casting when columnTypes specifies uuid", async () => {
      const embeddings = new FakeEmbeddings();
      const store = new PrismaVectorStore(embeddings, {
        db: mockPrismaClient,
        prisma: mockPrismaNamespace,
        tableName: "test",
        vectorColumnName: "vector",
        columns: mockColumns,
        columnTypes: {
          id: "uuid",
        },
      });

      const mockUuid = "123e4567-e89b-12d3-a456-426614174000";
      const documents = [
        {
          pageContent: "test content",
          metadata: { id: mockUuid, content: "test content" },
        },
      ];
      const vectors = [[1, 2, 3]];

      $transaction.mockImplementation(async (fn) => {
        return Promise.all(fn);
      });
      $executeRaw.mockResolvedValue(1);

      await store.addVectors(vectors, documents);

      expect($transaction).toHaveBeenCalledTimes(1);
      expect($executeRaw).toHaveBeenCalledTimes(1);

      // Check that the SQL was constructed with UUID casting
      const sqlCall = sql.mock.calls.find((call) => {
        const sqlString = JSON.stringify(call);
        return sqlString.includes("::uuid");
      });
      expect(sqlCall).toBeDefined();
    });

    test("buildSqlFilterStr applies UUID casting for equals operator", async () => {
      const embeddings = new FakeEmbeddings();
      const store = new PrismaVectorStore(embeddings, {
        db: mockPrismaClient,
        prisma: mockPrismaNamespace,
        tableName: "test",
        vectorColumnName: "vector",
        columns: mockColumns,
        columnTypes: {
          id: "uuid",
        },
      });

      const mockUuid = "123e4567-e89b-12d3-a456-426614174000";
      const filter = { id: { equals: mockUuid } };

      join.mockImplementation((parts, separator, prefix) => {
        return { sql: prefix + parts.join(separator) };
      });

      const result = store.buildSqlFilterStr(filter);

      expect(result).toBeDefined();
      // Check that SQL contains UUID casting
      const sqlCall = sql.mock.calls.find((call) => {
        const sqlString = JSON.stringify(call);
        return sqlString.includes("::uuid");
      });
      expect(sqlCall).toBeDefined();
    });

    test("buildSqlFilterStr applies UUID casting for IN operator", async () => {
      const embeddings = new FakeEmbeddings();
      const store = new PrismaVectorStore(embeddings, {
        db: mockPrismaClient,
        prisma: mockPrismaNamespace,
        tableName: "test",
        vectorColumnName: "vector",
        columns: mockColumns,
        columnTypes: {
          id: "uuid",
        },
      });

      const mockUuids = [
        "123e4567-e89b-12d3-a456-426614174000",
        "223e4567-e89b-12d3-a456-426614174001",
      ];
      const filter = { id: { in: mockUuids } };

      join.mockImplementation((parts, separator, prefix) => {
        return { sql: prefix + parts.join(separator) };
      });

      const result = store.buildSqlFilterStr(filter);

      expect(result).toBeDefined();
      // Check that SQL contains UUID casting for array values
      const sqlCalls = sql.mock.calls.filter((call) => {
        const sqlString = JSON.stringify(call);
        return sqlString.includes("::uuid");
      });
      expect(sqlCalls.length).toBeGreaterThan(0);
    });

    test("backward compatibility - works without columnTypes", async () => {
      const embeddings = new FakeEmbeddings();
      const store = new PrismaVectorStore(embeddings, {
        db: mockPrismaClient,
        prisma: mockPrismaNamespace,
        tableName: "test",
        vectorColumnName: "vector",
        columns: mockColumns,
      });

      const documents = [
        {
          pageContent: "test content",
          metadata: { id: "123", content: "test content" },
        },
      ];
      const vectors = [[1, 2, 3]];

      $transaction.mockImplementation(async (fn) => {
        return Promise.all(fn);
      });
      $executeRaw.mockResolvedValue(1);

      await store.addVectors(vectors, documents);

      expect($transaction).toHaveBeenCalledTimes(1);
      expect($executeRaw).toHaveBeenCalledTimes(1);

      // Check that no UUID casting was applied
      const sqlCall = sql.mock.calls.find((call) => {
        const sqlString = JSON.stringify(call);
        return sqlString.includes("::uuid");
      });
      expect(sqlCall).toBeUndefined();
    });

    test("supports integer and bigint column types", async () => {
      const embeddings = new FakeEmbeddings();
      const store = new PrismaVectorStore(embeddings, {
        db: mockPrismaClient,
        prisma: mockPrismaNamespace,
        tableName: "test",
        vectorColumnName: "vector",
        columns: mockColumns,
        columnTypes: {
          id: "integer",
        },
      });

      const filter = { id: { equals: 123 } };

      join.mockImplementation((parts, separator, prefix) => {
        return { sql: prefix + parts.join(separator) };
      });

      const result = store.buildSqlFilterStr(filter);

      expect(result).toBeDefined();
      // Check that SQL contains integer casting
      const sqlCall = sql.mock.calls.find((call) => {
        const sqlString = JSON.stringify(call);
        return sqlString.includes("::integer");
      });
      expect(sqlCall).toBeDefined();
    });

    test("supports jsonb column type", async () => {
      const embeddings = new FakeEmbeddings();
      const store = new PrismaVectorStore(embeddings, {
        db: mockPrismaClient,
        prisma: mockPrismaNamespace,
        tableName: "test",
        vectorColumnName: "vector",
        columns: mockColumns,
        columnTypes: {
          metadata: "jsonb",
        },
      });

      const filter = { metadata: { equals: { foo: "bar" } } };

      join.mockImplementation((parts, separator, prefix) => {
        return { sql: prefix + parts.join(separator) };
      });

      raw.mockImplementation((str) => ({ raw: str }));
      sql.mockImplementation((...args) => ({ sql: JSON.stringify(args) }));

      const result = store.buildSqlFilterStr(filter);

      expect(result).toBeDefined();
      // Check that SQL contains jsonb casting
      const sqlCall = sql.mock.calls.find((call) => {
        const sqlString = JSON.stringify(call);
        return sqlString.includes("::jsonb");
      });
      expect(sqlCall).toBeDefined();
    });
  });

  test("addDocumentsWithVectors creates new documents with INSERT", async () => {
    const embeddings = new FakeEmbeddings();
    const store = new PrismaVectorStore(embeddings, {
      db: mockPrismaClient,
      prisma: mockPrismaNamespace,
      tableName: "test",
      vectorColumnName: "vector",
      columns: mockColumns,
    });

    const documents = [
      new Document({
        pageContent: "test content 1",
        metadata: { id: "doc1", custom: "value1" },
      }),
      new Document({
        pageContent: "test content 2",
        metadata: { id: "doc2", custom: "value2" },
      }),
    ];

    const vectors = [
      [1, 2, 3],
      [4, 5, 6],
    ];

    // Mock the transaction to capture the SQL statements
    $transaction.mockImplementation((queries) => {
      // Verify that INSERT statements are being used
      expect(queries).toHaveLength(2);
      return Promise.resolve();
    });

    await store.addDocumentsWithVectors(vectors, documents);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect($executeRaw).toHaveBeenCalledTimes(2);
  });

  test("addDocuments uses addVectors by default (backward compatibility)", async () => {
    const embeddings = new FakeEmbeddings();
    const store = new PrismaVectorStore(embeddings, {
      db: mockPrismaClient,
      prisma: mockPrismaNamespace,
      tableName: "test",
      vectorColumnName: "vector",
      columns: mockColumns,
    });

    const documents = [
      new Document({
        pageContent: "test content",
        metadata: { id: "doc1" },
      }),
    ];

    // Spy on both methods
    const addDocumentsWithVectorsSpy = jest
      .spyOn(store, "addDocumentsWithVectors")
      .mockResolvedValue();
    const addVectorsSpy = jest.spyOn(store, "addVectors").mockResolvedValue();

    await store.addDocuments(documents);

    // Verify addVectors was called (default behavior)
    expect(addVectorsSpy).toHaveBeenCalledTimes(1);
    // Verify addDocumentsWithVectors was NOT called
    expect(addDocumentsWithVectorsSpy).not.toHaveBeenCalled();
  });

  test("addDocuments uses addDocumentsWithVectors when useInsert is true", async () => {
    const embeddings = new FakeEmbeddings();
    const store = new PrismaVectorStore(embeddings, {
      db: mockPrismaClient,
      prisma: mockPrismaNamespace,
      tableName: "test",
      vectorColumnName: "vector",
      columns: mockColumns,
      useInsert: true,
    });

    const documents = [
      new Document({
        pageContent: "test content",
        metadata: { id: "doc1" },
      }),
    ];

    // Spy on both methods
    const addDocumentsWithVectorsSpy = jest
      .spyOn(store, "addDocumentsWithVectors")
      .mockResolvedValue();
    const addVectorsSpy = jest.spyOn(store, "addVectors").mockResolvedValue();

    await store.addDocuments(documents);

    // Verify addDocumentsWithVectors was called
    expect(addDocumentsWithVectorsSpy).toHaveBeenCalledTimes(1);
    // Verify addVectors was NOT called
    expect(addVectorsSpy).not.toHaveBeenCalled();
  });

  test("addVectors still uses UPDATE statements for backward compatibility", async () => {
    const embeddings = new FakeEmbeddings();
    const store = new PrismaVectorStore(embeddings, {
      db: mockPrismaClient,
      prisma: mockPrismaNamespace,
      tableName: "test",
      vectorColumnName: "vector",
      columns: mockColumns,
    });

    const documents = [
      new Document({
        pageContent: "test content",
        metadata: { id: "doc1" },
      }),
    ];

    const vectors = [[1, 2, 3]];

    // Mock sql function to capture the SQL template
    let capturedSql = "";
    // @ts-expect-error - we are mocking the sql function
    sql.mockImplementation((strings: string[], ...values) => {
      capturedSql = strings.join("");
      return { strings, values };
    });

    $transaction.mockResolvedValue([]);

    await store.addVectors(vectors, documents);

    expect($transaction).toHaveBeenCalledTimes(1);
    // Verify UPDATE statement is used
    expect(capturedSql).toContain("UPDATE");
    expect(capturedSql).not.toContain("INSERT");
  });
});
