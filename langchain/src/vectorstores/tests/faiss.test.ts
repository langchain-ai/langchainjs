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
