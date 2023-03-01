/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";

import { PineconeStore } from "../pinecone.js";

test("PineconeStore with external ids", async () => {
  const client = {
    upsert: jest.fn(),
    query: jest.fn<any>().mockResolvedValue({
      matches: [],
    }),
  };
  const embeddings = new FakeEmbeddings();

  const store = new PineconeStore(client as any, embeddings);

  expect(store).toBeDefined();

  await store.addDocuments(
    [{ pageContent: "hello", metadata: { a: 1 } }],
    ["id1"]
  );

  expect(client.upsert).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello");

  expect(results).toHaveLength(0);
});

test("PineconeStore with generated ids", async () => {
  const client = {
    upsert: jest.fn(),
    query: jest.fn<any>().mockResolvedValue({
      matches: [],
    }),
  };
  const embeddings = new FakeEmbeddings();

  const store = new PineconeStore(client as any, embeddings);

  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

  expect(client.upsert).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello");

  expect(results).toHaveLength(0);
});
