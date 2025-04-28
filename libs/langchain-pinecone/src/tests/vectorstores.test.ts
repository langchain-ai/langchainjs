/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, jest, test } from "@jest/globals";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { PineconeStore } from "../vectorstores.js";

test("PineconeStore with external ids", async () => {
  const upsert = jest.fn();
  const client = {
    namespace: jest.fn<any>().mockReturnValue({
      upsert,
      query: jest.fn<any>().mockResolvedValue({
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

  expect(upsert).toHaveBeenCalledWith([
    {
      id: "id1",
      metadata: { a: 1, "b.nested.0": 1, "b.nested.1.a": 4, text: "hello" },
      values: [0.1, 0.2, 0.3, 0.4],
    },
  ]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(0);
});

test("PineconeStore with generated ids", async () => {
  const upsert = jest.fn();
  const client = {
    namespace: jest.fn<any>().mockReturnValue({
      upsert,
      query: jest.fn<any>().mockResolvedValue({
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
  const upsert = jest.fn();
  const client = {
    namespace: jest.fn<any>().mockReturnValue({
      upsert,
      query: jest.fn<any>().mockResolvedValue({
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

  expect(upsert).toHaveBeenCalledWith([
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
  ]);
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
      namespace: jest.fn<any>().mockReturnValue({
        query: jest.fn<any>().mockResolvedValue(mockQueryResponse),
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

test("PineconeStore throws when no config or index is passed", async () => {
  const embeddings = new FakeEmbeddings();

  expect(() => new PineconeStore(embeddings, {})).toThrow();
});

test("PineconeStore throws when config and index is passed", async () => {
  const upsert = jest.fn();
  const client = {
    namespace: jest.fn<any>().mockReturnValue({
      upsert,
      query: jest.fn<any>().mockResolvedValue({
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
