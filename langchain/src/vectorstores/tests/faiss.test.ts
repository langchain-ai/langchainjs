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

test("Test FaissStore.fromIndex + mergeFrom", async () => {
  const vectorStore1 = await FaissStore.fromDocuments(
    [
      new Document({
        pageContent: "hello world",
        metadata: { id: 1 },
      }),
    ],
    new FakeEmbeddings()
  );
  await vectorStore1.addVectors(
    [
      [1, 0, 0, 0],
      [1, 0, 0, 1],
    ],
    [
      new Document({
        pageContent: "my world",
        metadata: { id: 1 },
      }),
      new Document({
        pageContent: "our world",
        metadata: { id: 2 },
      }),
    ]
  );
  expect(vectorStore1.index?.ntotal()).toBe(3);

  const vectorStore2 = await FaissStore.fromDocuments(
    [
      new Document({
        pageContent: "hello world",
        metadata: { id: 3 },
      }),
    ],
    new FakeEmbeddings()
  );

  await vectorStore2.mergeFrom(vectorStore1);
  expect(vectorStore2.index?.ntotal()).toBe(4);

  const results1 = await vectorStore2.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    2
  );
  expect(results1).toHaveLength(2);
  expect(results1).toEqual([
    [new Document({ metadata: { id: 1 }, pageContent: "my world" }), 0],
    [new Document({ metadata: { id: 2 }, pageContent: "our world" }), 1],
  ]);

  const vectorStore3 = await FaissStore.fromIndex(
    vectorStore2,
    new FakeEmbeddings()
  );
  const results2 = await vectorStore3.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    2
  );
  expect(results2).toHaveLength(2);
  expect(results2).toEqual([
    [new Document({ metadata: { id: 1 }, pageContent: "my world" }), 0],
    [new Document({ metadata: { id: 2 }, pageContent: "our world" }), 1],
  ]);
});

test("Test FaissStore Exceptions", async () => {
  const vectorStore = new FaissStore(new FakeEmbeddings(), {});
  expect(() => vectorStore.index).toThrow(
    "Vector store not initialised yet. Try calling `fromTexts`, `fromDocuments` or `fromIndex` first."
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
  const vectorStore2 = new FaissStore(new FakeEmbeddings(), {});
  await vectorStore2.addVectors(
    [[1, 1, 1]],
    [
      new Document({
        pageContent: "different dimensions",
        metadata: { id: 9 },
      }),
    ]
  );
  await expect(async () => {
    await vectorStore2.mergeFrom(vectorStore);
  }).rejects.toThrow("Cannot merge indexes with different dimensions.");
  await expect(async () => {
    await FaissStore.load("_fake_path", new FakeEmbeddings());
  }).rejects.toThrow(/No such file or directory$/);
});
