// Revert to a unit test when https://github.com/hwchase17/langchainjs/issues/1383 is resolved

import { test, expect } from "@jest/globals";
import { FaissStore } from "../faiss.js";
import { Document } from "../../document.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";

test("Test FaissStore.fromTexts + addVectors", async () => {
  const vectorStore = await FaissStore.fromTexts(
    ["Hello world"],
    [{ id: 2 }],
    new FakeEmbeddings()
  );
  expect(vectorStore.index?.ntotal()).toBe(1);

  await vectorStore.addVectors(
    [
      [0, 1, 0, 0],
      [1, 0, 0, 0],
      [0.5, 0.5, 0.5, 0.5],
    ],
    [
      new Document({
        pageContent: "hello bye",
        metadata: { id: 5 },
      }),
      new Document({
        pageContent: "hello worlddwkldnsk",
        metadata: { id: 4 },
      }),
      new Document({
        pageContent: "hello you",
        metadata: { id: 6 },
      }),
    ]
  );
  expect(vectorStore.index?.ntotal()).toBe(4);

  const resultTwo = await vectorStore.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    3
  );
  const resultTwoMetadatas = resultTwo.map(([{ metadata }]) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 4 }, { id: 6 }, { id: 2 }]);
});

test("Test FaissStore.fromDocuments + addVectors", async () => {
  const vectorStore = await FaissStore.fromDocuments(
    [
      new Document({
        pageContent: "hello bye",
        metadata: { id: 5 },
      }),
      new Document({
        pageContent: "hello world",
        metadata: { id: 4 },
      }),
      new Document({
        pageContent: "hello you",
        metadata: { id: 6 },
      }),
    ],
    new FakeEmbeddings()
  );
  expect(vectorStore.index?.ntotal()).toBe(3);

  await vectorStore.addVectors(
    [
      [1, 0, 0, 0],
      [1, 0, 0, 1],
    ],
    [
      new Document({
        pageContent: "my world",
        metadata: { id: 7 },
      }),
      new Document({
        pageContent: "our world",
        metadata: { id: 8 },
      }),
    ]
  );
  expect(vectorStore.index?.ntotal()).toBe(5);

  const results = await vectorStore.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    2
  );
  expect(results).toHaveLength(2);
  expect(results).toEqual([
    [new Document({ metadata: { id: 7 }, pageContent: "my world" }), 0],
    [new Document({ metadata: { id: 8 }, pageContent: "our world" }), 1],
  ]);
});

test("Test FaissStore Exceptions", async () => {
  const vectorStore = new FaissStore(new FakeEmbeddings(), {});
  expect(() => vectorStore.index).toThrow(
    "Vector store not initialised yet. Try calling `fromTexts` or `fromDocuments` first."
  );
  await vectorStore.addVectors(
    [[1, 1]],
    [
      new Document({
        pageContent: "our world",
        metadata: { id: 8 },
      }),
    ]
  );
  await expect(async () => {
    await vectorStore.addVectors(
      [
        [1, 1],
        [1, 2],
      ],
      [
        new Document({
          pageContent: "our world",
          metadata: { id: 8 },
        }),
      ]
    );
  }).rejects.toThrow("Vectors and documents must have the same length");
  await expect(async () => {
    await vectorStore.addVectors(
      [[1, 1, 1]],
      [
        new Document({
          pageContent: "our world",
          metadata: { id: 8 },
        }),
      ]
    );
  }).rejects.toThrow(
    "Vectors must have the same length as the number of dimensions (2)"
  );
  await expect(async () => {
    await vectorStore.similaritySearchVectorWithScore([1, 1, 1], 1);
  }).rejects.toThrow(
    "Query vector must have the same length as the number of dimensions (2)"
  );
});
