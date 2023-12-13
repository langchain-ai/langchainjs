import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { USearch } from "../usearch.js";
import { FakeEmbeddings } from "../../utils/testing.js";

test("Test USearch.fromTexts + addVectors", async () => {
  const vectorStore = await USearch.fromTexts(
    ["Hello world"],
    [{ id: 2 }],
    new FakeEmbeddings()
  );
  expect(vectorStore.index?.size()).toBe(1n);

  await vectorStore.addVectors(
    [
      [0, 1, 0, 0],
      [0.5, 0.5, 0.5, 0.5],
    ],
    [
      new Document({
        pageContent: "hello bye",
        metadata: { id: 5 },
      }),
      new Document({
        pageContent: "hello you",
        metadata: { id: 6 },
      }),
    ]
  );
  expect(vectorStore.index?.size()).toBe(3n);

  const result = await vectorStore.similaritySearch("hello world", 2);
  expect(result[0].metadata).toEqual({ id: 2 });
});

test("Test USearch.fromDocuments + addVectors", async () => {
  const vectorStore = await USearch.fromDocuments(
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
  expect(vectorStore.index?.size()).toBe(3n);

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
  expect(vectorStore.index?.size()).toBe(5n);

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
