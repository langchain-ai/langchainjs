/* eslint-disable no-process-env */
import { test, expect, afterAll, beforeAll, describe } from "vitest";

import { RedisClientType, createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";

import { RedisVectorStore } from "../vectorstores.js";

describe("RedisVectorStore", () => {
  let vectorStore: RedisVectorStore;
  let client: RedisClientType;

  beforeAll(async () => {
    client = createClient({ url: process.env.REDIS_URL });
    await client.connect();

    vectorStore = new RedisVectorStore(new SyntheticEmbeddings(), {
      redisClient: client as RedisClientType,
      indexName: "test-index",
      keyPrefix: "test:",
    });
  });

  afterAll(async () => {
    await vectorStore.delete({ deleteAll: true });
    await client.quit();
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

    await vectorStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: uuid } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await vectorStore.similaritySearch(pageContent, 3, [
      `${uuid}`,
    ]);

    expect(results).toEqual([
      new Document({ metadata: { foo: uuid }, pageContent }),
    ]);
  });
});
