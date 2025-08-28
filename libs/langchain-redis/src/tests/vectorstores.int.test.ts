/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { RedisClientType, createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
import { test, expect } from "@jest/globals";
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

  test("delete documents by ids", async () => {
    const documentIds = ["doc1", "doc2"];
    const documentKeys = documentIds.map((id) => `test:${id}`);
    const pageContent = faker.lorem.sentence(5);

    const documents = documentKeys.map((key) => ({
      pageContent,
      metadata: {
        id: key,
      },
    }));

    await vectorStore.addDocuments(documents, {
      keys: documentKeys,
    });

    const results = await vectorStore.similaritySearch(pageContent, 2);
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.metadata.id)).toEqual(documentKeys);

    await vectorStore.delete({ ids: [documentIds[0]] });

    const results2 = await vectorStore.similaritySearch(pageContent, 2);
    expect(results2).toHaveLength(1);
    expect(results2.map((result) => result.metadata.id)).toEqual(
      documentKeys.slice(1)
    );
  });
});
