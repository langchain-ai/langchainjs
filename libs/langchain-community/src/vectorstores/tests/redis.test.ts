/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect, describe } from "@jest/globals";
import { FakeEmbeddings } from "../../utils/testing.js";

import { RedisVectorStore } from "../redis.js";

const createRedisClientMockup = () => {
  const hSetMock = jest.fn();

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
    multi: jest.fn<any>().mockImplementation(() => ({
      exec: jest.fn(),
      hSet: hSetMock,
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
    metadata: JSON.stringify({ a: 1, b: { nested: [1, { a: 4 }] } }),
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

test("RedisVectorStore with filters", async () => {
  const client = createRedisClientMockup();
  const embeddings = new FakeEmbeddings();

  const store = new RedisVectorStore(embeddings, {
    redisClient: client as any,
    indexName: "documents",
  });

  expect(store).toBeDefined();

  await store.similaritySearch("hello", 1, ["a"]);

  expect(client.ft.search).toHaveBeenCalledWith(
    "documents",
    "@metadata:(a) => [KNN 1 @content_vector $vector AS vector_score]",
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
