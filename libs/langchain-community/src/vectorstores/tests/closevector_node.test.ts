import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { CloseVectorNode } from "../closevector/node.js";

// Helper function to check if closevector-node is available
async function canImportCloseVector(): Promise<boolean> {
  try {
    await CloseVectorNode.imports();
    return true;
  } catch (error) {
    return false;
  }
}

test("Test CloseVectorNode.fromTexts + addVectors", async () => {
  if (!(await canImportCloseVector())) {
    console.warn(
      "Skipping CloseVectorNode test: closevector-node not available"
    );
    return;
  }
  const vectorStore = await CloseVectorNode.fromTexts(
    ["Hello world"],
    [{ id: 2 }],
    new FakeEmbeddings()
  );
  expect(vectorStore.instance.index?.getMaxElements()).toBe(1);
  expect(vectorStore.instance.index?.getCurrentCount()).toBe(1);

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
  expect(vectorStore.instance.index?.getMaxElements()).toBe(4);

  const resultTwo = await vectorStore.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    3
  );
  const resultTwoMetadatas = resultTwo.map(([{ metadata }]) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 4 }, { id: 6 }, { id: 2 }]);
});

test("Test CloseVectorNode metadata filtering", async () => {
  if (!(await canImportCloseVector())) {
    console.warn(
      "Skipping CloseVectorNode test: closevector-node not available"
    );
    return;
  }
  const pageContent = "Hello world";

  const vectorStore = await CloseVectorNode.fromTexts(
    [pageContent, pageContent, pageContent],
    [{ id: 2 }, { id: 3 }, { id: 4 }],
    new FakeEmbeddings()
  );

  // If the filter wasn't working, we'd get all 3 documents back
  const results = await vectorStore.similaritySearch(
    pageContent,
    3,
    (document) => document.metadata.id === 3
  );

  expect(results).toEqual([new Document({ metadata: { id: 3 }, pageContent })]);
});
