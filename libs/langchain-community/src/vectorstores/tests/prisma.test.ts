/* eslint-disable @typescript-eslint/no-explicit-any */
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { jest, test, expect } from "@jest/globals";
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
});
