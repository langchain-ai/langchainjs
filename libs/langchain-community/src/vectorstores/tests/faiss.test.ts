import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { FaissStore } from "../faiss.js";
import { FakeEmbeddings } from "../../utils/testing.js";

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

test("Test FaissStore.addDocuments", async () => {
  const vectorStore = new FaissStore(new FakeEmbeddings(), {});
  const idsReturned = await vectorStore.addDocuments([
    { pageContent: "bar", metadata: { id: 4, name: "4" } },
    { pageContent: "baz", metadata: { id: 5, name: "5" } },
  ]);

  expect(idsReturned.length).toEqual(2);

  const ids = ["2", "1", "4"];
  const idsReturned1 = await vectorStore.addDocuments(
    [
      { pageContent: "bar", metadata: { id: 4, name: "4" } },
      { pageContent: "baz", metadata: { id: 5, name: "5" } },
    ],
    {
      ids,
    }
  );

  expect(idsReturned1).toStrictEqual(ids);
  expect(vectorStore.index?.ntotal()).toBe(4);
  expect(Object.keys(vectorStore._mapping).length).toBe(4);
  expect(vectorStore.docstore._docs.size).toBe(4);
});

test("Test FaissStore.delete", async () => {
  const vectorStore = new FaissStore(new FakeEmbeddings(), {});
  const ids = ["2", "1", "4"];
  const idsReturned = await vectorStore.addVectors(
    [
      [1, 0, 0, 0],
      [1, 0, 0, 1],
      [1, 1, 0, 1],
    ],
    [
      new Document({
        pageContent: "my world",
        metadata: { tag: 2 },
      }),
      new Document({
        pageContent: "our world",
        metadata: { tag: 1 },
      }),
      new Document({
        pageContent: "your world",
        metadata: { tag: 4 },
      }),
    ],
    {
      ids,
    }
  );

  expect(idsReturned).toStrictEqual(ids);

  expect(vectorStore.index?.ntotal()).toBe(3);
  expect(Object.keys(vectorStore._mapping).length).toBe(3);
  expect(vectorStore.docstore._docs.size).toBe(3);

  const [[doc]] = await vectorStore.similaritySearchVectorWithScore(
    [1, 1, 0, 1],
    1
  );
  expect(doc.metadata.tag).toEqual(4);

  await vectorStore.delete({ ids: ids.slice(2) });

  expect(vectorStore.index?.ntotal()).toBe(2);
  expect(Object.keys(vectorStore._mapping).length).toBe(2);
  expect(vectorStore.docstore._docs.size).toBe(2);

  const [[doc1]] = await vectorStore.similaritySearchVectorWithScore(
    [1, 1, 0, 1],
    1
  );
  expect(doc1.metadata.tag).toEqual(1);

  const idsReturned1 = await vectorStore.addVectors(
    [
      [1, 0, 0, 0],
      [1, 1, 0, 1],
    ],
    [
      new Document({
        pageContent: "my world 1",
        metadata: { tag: 7 },
      }),
      new Document({
        pageContent: "our world 2",
        metadata: { tag: 8 },
      }),
    ]
  );

  expect(idsReturned1.length).toStrictEqual(2);
  const [[doc2]] = await vectorStore.similaritySearchVectorWithScore(
    [1, 1, 0, 1],
    1
  );
  expect(doc2.metadata.tag).toEqual(8);

  await vectorStore.delete({ ids: [idsReturned1[0]] });
  const [[doc3]] = await vectorStore.similaritySearchVectorWithScore(
    [1, 1, 0, 1],
    1
  );
  expect(doc3.metadata.tag).toEqual(8);
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

  const vectorStore3 = new FaissStore(new FakeEmbeddings(), {});
  await expect(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await vectorStore3.delete({ ids: null as any });
  }).rejects.toThrow("No documentIds provided to delete.");

  await expect(async () => {
    await vectorStore3.delete({ ids: ["123"] });
  }).rejects.toThrow(
    "Some specified documentIds do not exist in the current store. DocumentIds not found: 123"
  );
});
