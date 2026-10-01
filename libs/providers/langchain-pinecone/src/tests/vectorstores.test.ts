/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, expect, it, vi } from "vitest";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { Index } from "@pinecone-database/pinecone";
import { PineconeStore } from "../vectorstores.js";

// Record the arguments PineconeStore constructs its Index with, while still
// building a real Index.
vi.mock("@pinecone-database/pinecone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@pinecone-database/pinecone")>();
  return { ...actual, Index: vi.fn(actual.Index) };
});

test("PineconeStore with external ids", async () => {
  const upsert = vi.fn();
  const client = {
    namespace: vi.fn().mockReturnValue({
      upsert,
      query: vi.fn().mockResolvedValue({
        matches: [],
      }),
    }),
  };
  const embeddings = new FakeEmbeddings();
  const store = new PineconeStore(embeddings, { pineconeIndex: client as any });
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
    ["id1"]
  );
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(upsert).toHaveBeenCalledWith({
    records: [
      {
        id: "id1",
        metadata: { a: 1, "b.nested.0": 1, "b.nested.1.a": 4, text: "hello" },
        values: [0.1, 0.2, 0.3, 0.4],
      },
    ],
  });

  const results = await store.similaritySearch("hello", 1);
  expect(results).toHaveLength(0);
});

test("PineconeStore with generated ids", async () => {
  const upsert = vi.fn();
  const client = {
    namespace: vi.fn().mockReturnValue({
      upsert,
      query: vi.fn().mockResolvedValue({
        matches: [],
      }),
    }),
  };
  const embeddings = new FakeEmbeddings();

  const store = new PineconeStore(embeddings, { pineconeIndex: client as any });
  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);
  expect(upsert).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello", 1);
  expect(results).toHaveLength(0);
});

test("PineconeStore with string arrays", async () => {
  const upsert = vi.fn();
  const client = {
    namespace: vi.fn().mockReturnValue({
      upsert,
      query: vi.fn().mockResolvedValue({
        matches: [],
      }),
    }),
  };
  const embeddings = new FakeEmbeddings();
  const store = new PineconeStore(embeddings, { pineconeIndex: client as any });

  await store.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: {
          a: 1,
          b: { nested: [1, { a: 4 }] },
          c: ["some", "string", "array"],
          d: [1, { nested: 2 }, "string"],
        },
      },
    ],
    ["id1"]
  );

  expect(upsert).toHaveBeenCalledWith({
    records: [
      {
        id: "id1",
        metadata: {
          a: 1,
          "b.nested.0": 1,
          "b.nested.1.a": 4,
          c: ["some", "string", "array"],
          "d.0": 1,
          "d.1.nested": 2,
          "d.2": "string",
          text: "hello",
        },
        values: [0.1, 0.2, 0.3, 0.4],
      },
    ],
  });
});

describe("PineconeStore with null pageContent", () => {
  it("should handle null pageContent correctly in _formatMatches", async () => {
    const mockQueryResponse = {
      matches: [
        {
          id: "1",
          score: 0.9,
          metadata: { textKey: null, otherKey: "value" },
        },
      ],
    };

    const client = {
      namespace: vi.fn().mockReturnValue({
        query: vi.fn().mockResolvedValue(mockQueryResponse),
      }),
    };
    const embeddings = new FakeEmbeddings();
    const store = new PineconeStore(embeddings, {
      pineconeIndex: client as any,
    });

    const results = await store.similaritySearchVectorWithScore([], 0);
    expect(results[0][0].pageContent).toEqual("");
  });
});

test("PineconeStore can instantiate without passing in client", async () => {
  const embeddings = new FakeEmbeddings();
  const store = new PineconeStore(embeddings, {
    pineconeConfig: {
      indexName: "indexName",
      config: {
        apiKey: "apiKey",
      },
    },
  });
  expect(store.pineconeIndex).toBeDefined();
});

test("PineconeStore passes pineconeConfig to the Index as IndexOptions", async () => {
  const embeddings = new FakeEmbeddings();
  new PineconeStore(embeddings, {
    pineconeConfig: {
      indexName: "indexName",
      config: {
        apiKey: "apiKey",
      },
      namespace: "namespace",
      indexHostUrl: "https://index-host.example",
      additionalHeaders: { "x-header": "value" },
    },
  });
  expect(Index).toHaveBeenLastCalledWith(
    {
      name: "indexName",
      namespace: "namespace",
      host: "https://index-host.example",
      additionalHeaders: { "x-header": "value" },
    },
    { apiKey: "apiKey", sourceTag: "langchainjs" }
  );
});

test("PineconeStore throws when no config or index is passed", async () => {
  const embeddings = new FakeEmbeddings();
  expect(() => new PineconeStore(embeddings, {})).toThrow();
});

test("PineconeStore throws when config and index is passed", async () => {
  const upsert = vi.fn();
  const client = {
    namespace: vi.fn().mockReturnValue({
      upsert,
      query: vi.fn().mockResolvedValue({
        matches: [],
      }),
    }),
  };
  const embeddings = new FakeEmbeddings();

  expect(
    () =>
      new PineconeStore(embeddings, {
        pineconeIndex: client as any,
        pineconeConfig: {
          indexName: "indexName",
          config: {
            apiKey: "apiKey",
          },
        },
      })
  ).toThrow();
});
