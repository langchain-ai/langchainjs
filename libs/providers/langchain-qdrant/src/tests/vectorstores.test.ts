/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi } from "vitest";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

import {
  QdrantVectorStore,
  type SparseEmbeddingsInterface,
} from "../vectorstores.js";

test("QdrantVectorStore works", async () => {
  const client = {
    upsert: vi.fn(),
    query: vi.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: vi.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: vi.fn(),
  };

  const embeddings = new FakeEmbeddings();

  const store = new QdrantVectorStore(embeddings, {
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
    upsert: vi.fn(),
    query: vi.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: vi.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: vi.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
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
    upsert: vi.fn(),
    query: vi.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: vi.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: vi.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
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
    upsert: vi.fn(),
    query: vi.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: vi.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: vi.fn(),
  };

  // Mock embeddings
  const embeddings = new FakeEmbeddings();

  // Create QdrantVectorStore instance with the mock client
  const qdrantVectorStore = new QdrantVectorStore(embeddings, {
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
    upsert: vi.fn(),
    query: vi.fn<any>().mockResolvedValue({ points: [] }),
    getCollections: vi.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: vi.fn(),
  };

  const embeddings = new FakeEmbeddings();

  const store = new QdrantVectorStore(embeddings, {
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

function mockClient() {
  return {
    upsert: vi.fn(),
    query: vi.fn<any>().mockResolvedValue({
      points: [
        {
          id: "1",
          version: 0,
          score: 0.5,
          payload: { content: "hello", metadata: { a: 1 } },
        },
      ],
    }),
    getCollections: vi.fn<any>().mockResolvedValue({ collections: [] }),
    createCollection: vi.fn(),
  };
}

class FakeSparseEmbeddings implements SparseEmbeddingsInterface {
  async embedDocuments(texts: string[]) {
    return texts.map((_, i) => ({ indices: [i], values: [1] }));
  }

  async embedQuery(_text: string) {
    return { indices: [7], values: [0.5] };
  }
}

const FILTER = {
  must: [{ key: "metadata.a", match: { value: 1 } }],
};

describe("retrievalMode: dense", () => {
  test("similaritySearch sends the same request as before", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
    });

    const results = await store.similaritySearch("hello", 3, FILTER);

    expect(results).toEqual([
      new Document({ id: "1", pageContent: "hello", metadata: { a: 1 } }),
    ]);
    expect(client.query).toHaveBeenCalledWith("documents", {
      query: [0.1, 0.2, 0.3, 0.4],
      limit: 3,
      filter: FILTER,
      with_payload: ["metadata", "content"],
      with_vector: false,
    });
    expect(client.createCollection).toHaveBeenCalledWith("documents", {
      vectors: { size: 4, distance: "Cosine" },
    });
  });

  test("upserts an unnamed dense vector", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
    });

    await store.addDocuments([{ pageContent: "hello", metadata: {} }]);

    expect(client.upsert.mock.calls[0][1].points[0].vector).toEqual([
      0.1, 0.2, 0.3, 0.4,
    ]);
  });

  test("uses a named dense vector when vectorName is set", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      vectorName: "dense",
    });

    await store.addDocuments([{ pageContent: "hello", metadata: {} }]);
    await store.similaritySearch("hello", 1);
    await store.maxMarginalRelevanceSearch("hello", { k: 1 });

    expect(client.createCollection).toHaveBeenCalledWith("documents", {
      vectors: { dense: { size: 4, distance: "Cosine" } },
    });
    expect(client.upsert.mock.calls[0][1].points[0].vector).toEqual({
      dense: [0.1, 0.2, 0.3, 0.4],
    });
    expect(client.query.mock.calls[0][1].using).toBe("dense");
    expect(client.query.mock.calls[1][1].using).toBe("dense");
  });
});

describe("retrievalMode: hybrid", () => {
  test("sends a dense and a sparse prefetch, fused with RRF by default", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "hybrid",
    });

    const results = await store.similaritySearchWithScore("hello", 3, FILTER);

    expect(results).toEqual([
      [
        new Document({ id: "1", pageContent: "hello", metadata: { a: 1 } }),
        0.5,
      ],
    ]);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith("documents", {
      prefetch: [
        { query: [0.1, 0.2, 0.3, 0.4], limit: 3, filter: FILTER },
        {
          query: { text: "hello", model: "qdrant/bm25" },
          using: "langchain-sparse",
          limit: 3,
          filter: FILTER,
        },
      ],
      query: { fusion: "rrf" },
      limit: 3,
      filter: FILTER,
      with_payload: ["metadata", "content"],
      with_vector: false,
    });
  });

  test("uses custom fusion, vector names and sparse document options", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "hybrid",
      vectorName: "dense",
      sparseVectorName: "bm25",
      sparseDocumentOptions: {
        model: "qdrant/bm25",
        options: { language: "italian" },
      },
      hybridFusion: { rrf: { weights: [1, 3] } },
    });

    await store.similaritySearch("contratti", 2);

    const request = client.query.mock.calls[0][1];
    expect(request.query).toEqual({ rrf: { weights: [1, 3] } });
    expect(request.prefetch[0].using).toBe("dense");
    expect(request.prefetch[1]).toEqual({
      query: {
        text: "contratti",
        model: "qdrant/bm25",
        options: { language: "italian" },
      },
      using: "bm25",
      limit: 2,
      filter: undefined,
    });
  });

  test("asRetriever uses the hybrid query", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "hybrid",
    });

    const docs = await store.asRetriever({ k: 2 }).invoke("hello");

    expect(docs).toHaveLength(1);
    expect(client.query.mock.calls[0][1].prefetch).toHaveLength(2);
  });

  test("creates the collection with dense and BM25 sparse vectors", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "hybrid",
    });

    await store.addDocuments([
      { pageContent: "hello", metadata: {} },
      { pageContent: "world", metadata: {} },
    ]);

    expect(client.createCollection).toHaveBeenCalledWith("documents", {
      vectors: { size: 4, distance: "Cosine" },
      sparse_vectors: { "langchain-sparse": { modifier: "idf" } },
    });
    const points = client.upsert.mock.calls[0][1].points;
    expect(points.map((p: any) => p.vector)).toEqual([
      {
        "": [0.1, 0.2, 0.3, 0.4],
        "langchain-sparse": { text: "hello", model: "qdrant/bm25" },
      },
      {
        "": [0.1, 0.2, 0.3, 0.4],
        "langchain-sparse": { text: "world", model: "qdrant/bm25" },
      },
    ]);
  });

  test("uses client-side sparse vectors with sparseEmbeddings", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "hybrid",
      sparseEmbeddings: new FakeSparseEmbeddings(),
    });

    await store.addDocuments([
      { pageContent: "hello", metadata: {} },
      { pageContent: "world", metadata: {} },
    ]);
    await store.similaritySearch("hello", 1);

    expect(client.createCollection).toHaveBeenCalledWith("documents", {
      vectors: { size: 4, distance: "Cosine" },
      sparse_vectors: { "langchain-sparse": {} },
    });
    const points = client.upsert.mock.calls[0][1].points;
    expect(points[1].vector["langchain-sparse"]).toEqual({
      indices: [1],
      values: [1],
    });
    expect(client.query.mock.calls[0][1].prefetch[1].query).toEqual({
      indices: [7],
      values: [0.5],
    });
  });

  test("similaritySearchVectorWithScore searches the dense vector only", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "hybrid",
    });

    await store.similaritySearchVectorWithScore([1, 2, 3, 4], 1);

    expect(client.query.mock.calls[0][1]).toEqual({
      query: [1, 2, 3, 4],
      limit: 1,
      filter: undefined,
      with_payload: ["metadata", "content"],
      with_vector: false,
    });
  });

  test("leaves a user collectionConfig untouched", async () => {
    const client = mockClient();
    const collectionConfig = {
      vectors: { size: 4, distance: "Dot" as const },
      sparse_vectors: { "langchain-sparse": { modifier: "idf" as const } },
    };
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "hybrid",
      collectionConfig,
    });

    await store.ensureCollection();

    expect(client.createCollection).toHaveBeenCalledWith(
      "documents",
      collectionConfig
    );
  });
});

describe("retrievalMode: sparse", () => {
  test("sends one query on the sparse vector", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "sparse",
    });

    await store.similaritySearch("hello", 3, FILTER);

    expect(client.query).toHaveBeenCalledWith("documents", {
      query: { text: "hello", model: "qdrant/bm25" },
      using: "langchain-sparse",
      limit: 3,
      filter: FILTER,
      with_payload: ["metadata", "content"],
      with_vector: false,
    });
  });

  test("does not compute dense embeddings", async () => {
    const client = mockClient();
    const embeddings = new FakeEmbeddings();
    const embedDocuments = vi.spyOn(embeddings, "embedDocuments");
    const embedQuery = vi.spyOn(embeddings, "embedQuery");
    const store = new QdrantVectorStore(embeddings, {
      client: client as any,
      retrievalMode: "sparse",
      sparseEmbeddings: new FakeSparseEmbeddings(),
    });

    await store.addDocuments([{ pageContent: "hello", metadata: {} }]);
    await store.similaritySearch("hello", 1);

    expect(embedDocuments).not.toHaveBeenCalled();
    expect(embedQuery).not.toHaveBeenCalled();
    expect(client.createCollection).toHaveBeenCalledWith("documents", {
      vectors: {},
      sparse_vectors: { "langchain-sparse": {} },
    });
    expect(client.upsert.mock.calls[0][1].points[0].vector).toEqual({
      "langchain-sparse": { indices: [0], values: [1] },
    });
    expect(client.query.mock.calls[0][1].query).toEqual({
      indices: [7],
      values: [0.5],
    });
  });

  test("creates a sparse-only collection with the idf modifier", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "sparse",
    });

    await store.ensureCollection();

    expect(client.createCollection).toHaveBeenCalledWith("documents", {
      vectors: {},
      sparse_vectors: { "langchain-sparse": { modifier: "idf" } },
    });
  });

  test("methods that need the dense vector throw", async () => {
    const client = mockClient();
    const store = new QdrantVectorStore(new FakeEmbeddings(), {
      client: client as any,
      retrievalMode: "sparse",
    });

    await expect(
      store.similaritySearchVectorWithScore([1, 2, 3, 4], 1)
    ).rejects.toThrow(/not supported in "sparse" retrieval mode/);
    await expect(
      store.maxMarginalRelevanceSearch("hello", { k: 1 })
    ).rejects.toThrow(/not supported in "sparse" retrieval mode/);
    await expect(
      store.addVectors([[1, 2, 3, 4]], [new Document({ pageContent: "x" })])
    ).rejects.toThrow(/not supported in "sparse" retrieval mode/);
    expect(client.query).not.toHaveBeenCalled();
  });
});
