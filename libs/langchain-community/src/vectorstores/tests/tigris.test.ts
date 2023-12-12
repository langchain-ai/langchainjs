/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../utils/testing.js";

import { TigrisVectorStore } from "../tigris.js";

test("TigrisVectorStore with external ids", async () => {
  const client = {
    addDocumentsWithVectors: jest.fn(),
    similaritySearchVectorWithScore: jest
      .fn()
      .mockImplementation(async () => []),
  };
  const embeddings = new FakeEmbeddings();

  const store = new TigrisVectorStore(embeddings, {
    index: client as any,
  });

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

  expect(client.addDocumentsWithVectors).toHaveBeenCalledTimes(1);

  expect(client.addDocumentsWithVectors).toHaveBeenCalledWith({
    ids: ["id1"],
    embeddings: [[0.1, 0.2, 0.3, 0.4]],
    documents: [
      {
        content: "hello",
        metadata: {
          a: 1,
          b: { nested: [1, { a: 4 }] },
        },
      },
    ],
  });

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(0);
});

test("TigrisVectorStore with generated ids", async () => {
  const client = {
    addDocumentsWithVectors: jest.fn(),
    similaritySearchVectorWithScore: jest
      .fn()
      .mockImplementation(async () => []),
  };
  const embeddings = new FakeEmbeddings();

  const store = new TigrisVectorStore(embeddings, { index: client as any });

  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

  expect(client.addDocumentsWithVectors).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(0);
});
