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

test("QdrantVectorStore adds vectors with custom payload", async () => {
  // Mock Qdrant client
  const client = {
    upsert: jest.fn(),
    search: jest.fn<any>().mockResolvedValue([]),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
    client: client as any,
  });

  // Define a custom payload
  const customPayload = {
    customField1: "value1",
    customField2: "value2",
  };

  // Add documents with custom payload
  await qdrantVectorStore.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: {},
      },
    ],
    customPayload
  );

  // Verify that the Qdrant client's upsert method was called with the correct arguments
  expect(client.upsert).toHaveBeenCalledTimes(1);
  expect(client.upsert).toHaveBeenCalledWith("documents", {
    wait: true,
    points: [
      expect.objectContaining({
        payload: expect.objectContaining({
          content: "hello",
          metadata: {},
          ...customPayload,
        }),
      }),
    ],
  });
});

test("QdrantVectorStore adds vectors with custom payload in Document", async () => {
  // Mock Qdrant client
  const client = {
    upsert: jest.fn(),
    search: jest.fn<any>().mockResolvedValue([]),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
    client: client as any,
  });

  // Define a custom payload
  const customPayload = {
    customField1: "value1",
    customField2: "value2",
  };

  // Add documents with custom payload
  await qdrantVectorStore.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: {},
        customPayload: customPayload
      },
    ],
  );

  // Verify that the Qdrant client's upsert method was called with the correct arguments
  expect(client.upsert).toHaveBeenCalledTimes(1);
  expect(client.upsert).toHaveBeenCalledWith("documents", {
    wait: true,
    points: [
      expect.objectContaining({
        payload: expect.objectContaining({
          content: "hello",
          metadata: {},
          ...customPayload,
        }),
      }),
    ],
  });
});
