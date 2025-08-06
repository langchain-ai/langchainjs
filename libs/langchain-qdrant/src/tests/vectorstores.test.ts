/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

import { QdrantVectorStore } from "../vectorstores.js";

test("QdrantVectorStore works", async () => {
  const client = {
    upsert: jest.fn(),
    query: jest.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  const embeddings = new FakeEmbeddings();

  const store = new QdrantVectorStore(embeddings, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
  });

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
    query: jest.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
  });

  // Define a custom payload
  const customPayload = {
    customPayload: [
      {
        customField1: "value1",
        customField2: "value2",
      },
    ],
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
          customPayload: customPayload.customPayload[0],
        }),
      }),
    ],
  });
});

test("QdrantVectorStore adds vectors with multiple custom payload", async () => {
  // Mock Qdrant client
  const client = {
    upsert: jest.fn(),
    query: jest.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
  });

  // Define a custom payload
  const customPayload = {
    customPayload: [
      {
        customField1: "value1",
        customField2: "value2",
      },
      {
        customField3: "value3",
      },
    ],
  };

  // Add documents with custom payload
  await qdrantVectorStore.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: {},
      },
      {
        pageContent: "Goodbye",
        metadata: {},
      },
      {
        pageContent: "D01",
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
          customPayload: customPayload.customPayload[0],
        }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          content: "Goodbye",
          metadata: {},
          customPayload: customPayload.customPayload[1],
        }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          content: "D01",
          metadata: {},
        }),
      }),
    ],
  });
});

test("QdrantVectorStore adds vectors with no custom payload", async () => {
  // Mock Qdrant client
  const client = {
    upsert: jest.fn(),
    query: jest.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
  });

  // Add documents with custom payload
  await qdrantVectorStore.addDocuments([
    {
      pageContent: "hello",
      metadata: {},
    },
  ]);

  // Verify that the Qdrant client's upsert method was called with the correct arguments
  expect(client.upsert).toHaveBeenCalledTimes(1);
  expect(client.upsert).toHaveBeenCalledWith("documents", {
    wait: true,
    points: [
      expect.objectContaining({
        payload: expect.objectContaining({
          content: "hello",
          metadata: {},
        }),
      }),
    ],
  });
});

test("QdrantVectorStore MMR works", async () => {
  const client = {
    upsert: jest.fn(),
    query: jest.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: jest.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn(),
  };

  const embeddings = new FakeEmbeddings();

  const store = new QdrantVectorStore(embeddings, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
  });

  expect(store).toBeDefined();

  await store.addDocuments([
    {
      pageContent: "hello",
      metadata: {},
    },
  ]);

  expect(client.upsert).toHaveBeenCalledTimes(1);

  expect(store.maxMarginalRelevanceSearch).toBeDefined();

  await store.maxMarginalRelevanceSearch("hello", {
    k: 10,
    fetchK: 7,
  });

  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.query).toHaveBeenCalledWith("documents", {
    filter: undefined,
    limit: 10,
    query: {
      nearest: [0.1, 0.2, 0.3, 0.4],
      mmr: {
        diversity: null,
        candidates_limit: 7,
      },
    },
    with_payload: ["metadata", "content"],
    with_vector: true,
  });
});
