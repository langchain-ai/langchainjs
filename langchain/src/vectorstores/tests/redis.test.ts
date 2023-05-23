/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";

import { RedisVectorStore } from "../redis.js";

const createRedisClientMockup = () => {
  const hSetMock = jest.fn();

  return {
    ft: {
      info: jest.fn(),
      create: jest.fn(),
      search: jest.fn<any>().mockResolvedValue({
        total: 0,
        documents: [],
      }),
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
