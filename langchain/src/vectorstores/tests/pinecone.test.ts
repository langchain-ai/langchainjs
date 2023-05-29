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

  const store = new PineconeStore(embeddings, { pineconeIndex: client as any });

  expect(store).toBeDefined();

  await store.addDocuments(
    [
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
    ],
    ["id1"]
  );

  expect(client.upsert).toHaveBeenCalledTimes(1);

  expect(client.upsert).toHaveBeenCalledWith({
    upsertRequest: {
      namespace: undefined,
      vectors: [
        {
          id: "id1",
          metadata: { a: 1, text: "hello" },
          values: [0.1, 0.2, 0.3, 0.4],
        },
      ],
    },
  });

  const results = await store.similaritySearch("hello", 1);

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

  const store = new PineconeStore(embeddings, { pineconeIndex: client as any });

  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

  expect(client.upsert).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(0);
});

test("PineconeStore flattens metadata values and removes null values when adding documents", async () => {
  const client = { upsert: jest.fn() };
  const embeddings = new FakeEmbeddings();
  const store = new PineconeStore(embeddings, { pineconeIndex: client as any });

  const document = {
    pageContent: "hello",
    metadata: {
      string: "some_string",
      number: 3.14,
      boolean: true,
      string_array: ["string_0", "string_1"],
      null: null,
      number_array: [0, 1],
      object: {
        string_in_nested_object: "some_string",
        string_array_in_nested_object: ["string_0", "string_1"]
      },
    }
  }

  await store.addDocuments([document], ["some_id"]);

  expect(client.upsert).toHaveBeenCalledTimes(1);

  expect(client.upsert).toHaveBeenLastCalledWith({
    upsertRequest: {
      namespace: undefined,
      vectors: [
        {
          id: "some_id",
          metadata: {
            string: "some_string",
            boolean: true,
            number: 3.14,
            "string_array.0": "string_0",
            "string_array.1": "string_1",
            "number_array.0": 0,
            "number_array.1": 1,
            "object.string_in_nested_object": "some_string",
            "object.string_array_in_nested_object.0": "string_0",
            "object.string_array_in_nested_object.1": "string_1",
            // pageContent
            "text": "hello"
          },
          values: [
            0.1,
            0.2,
            0.3,
            0.4
          ]
        }
      ]
    }
  });
});
