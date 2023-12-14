/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../utils/testing.js";

import { QdrantVectorStore } from "../qdrant.js";

test("QdrantVectorStore works", async () => {
  const client = {
    upsert: jest.fn(),
    search: jest.fn<any>().mockResolvedValue([]),
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
    search: jest.fn<any>().mockResolvedValue([]),
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
    search: jest.fn<any>().mockResolvedValue([]),
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
    search: jest.fn<any>().mockResolvedValue([]),
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
