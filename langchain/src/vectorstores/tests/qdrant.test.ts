/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";

import { QdrantVectorStore } from "../qdrant.js";

test("QdrantVectorStore works", async () => {
  const client = {
    upsert: jest.fn(),
    search: jest.fn<any>().mockResolvedValue([]),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  const embeddings = new FakeEmbeddings();

  const store = new QdrantVectorStore(embeddings, { client: client as any });

  expect(store).toBeDefined();

  await store.addDocuments([
    {
      pageContent: "hello",
      metadata: {},
    },
  ]);

  expect(client.upsert).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(0);
});
