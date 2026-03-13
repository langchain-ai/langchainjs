import { describe, expect, test, jest } from "@jest/globals";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { PGVectorStore } from "../../pgvector.js";

class MockEmbeddings implements EmbeddingsInterface {
  embedQuery(_text: string): Promise<number[]> {
    return Promise.resolve(Array(10).fill(0));
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(() => Array(10).fill(0)));
  }
}

const embeddings = new MockEmbeddings();

const baseConnectionOptions = {
  host: "test",
  port: 5432,
  user: "test",
  password: "test",
  database: "test",
};

describe("PGVectorStore pool management", () => {
  test("end() calls pool.end() when pool was created internally", async () => {
    const store = new PGVectorStore(embeddings, {
      tableName: "test_table",
      postgresConnectionOptions: baseConnectionOptions,
    });

    const poolEndMock = jest
      .spyOn(store.pool, "end")
      .mockResolvedValue(undefined as never);

    await store.end();

    expect(poolEndMock).toHaveBeenCalledTimes(1);
    poolEndMock.mockRestore();
  });

  test("end() does NOT call pool.end() when using an external pool", async () => {
    // Create a mock pool with the minimal interface PGVectorStore needs
    const mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };

    const store = new PGVectorStore(embeddings, {
      tableName: "test_table",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool: mockPool as any,
    });

    await store.end();

    expect(mockPool.end).not.toHaveBeenCalled();
  });

  test("_initializeClient() does not check out a client from the pool", async () => {
    const store = new PGVectorStore(embeddings, {
      tableName: "test_table",
      postgresConnectionOptions: baseConnectionOptions,
    });

    const connectMock = jest.spyOn(store.pool, "connect");

    // @ts-expect-error - _initializeClient is protected
    await store._initializeClient();

    expect(connectMock).not.toHaveBeenCalled();
    expect(store.client).toBeUndefined();
    connectMock.mockRestore();
  });
});
