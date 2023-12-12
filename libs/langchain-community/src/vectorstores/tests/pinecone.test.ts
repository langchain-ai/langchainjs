/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../utils/testing.js";
import { PineconeStore } from "../pinecone.js";

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

test("PineconeSo with string arrays", async () => {
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
