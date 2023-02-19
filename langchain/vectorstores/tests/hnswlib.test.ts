import { test, expect } from "@jest/globals";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { HNSWLib } from "../hnswlib";
import { Document } from "../../document";
import { FakeEmbeddings } from "../../embeddings/fake";

test("Test HNSWLib.fromTexts", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new FakeEmbeddings()
  );
  expect(vectorStore.index?.getCurrentCount()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  const resultOneMetadatas = resultOne.map(({ metadata }) => metadata);
  expect(resultOneMetadatas).toEqual([{ id: 3 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 2 }, { id: 1 }, { id: 3 }]);
});

test("Test HNSWLib.fromTexts + addDocuments", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new FakeEmbeddings()
  );
  expect(vectorStore.index?.getMaxElements()).toBe(3);
  expect(vectorStore.index?.getCurrentCount()).toBe(3);

  await vectorStore.addDocuments([
    new Document({
      pageContent: "hello worldklmslksmn",
      metadata: { id: 4 },
    }),
  ]);
  expect(vectorStore.index?.getMaxElements()).toBe(4);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 4 }, { id: 1 }, { id: 3 }]);
});

test("Test HNSWLib.fromTexts + addVectors", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye"],
    [{ id: 2 }, { id: 1 }],
    new FakeEmbeddings()
  );
  expect(vectorStore.index?.getMaxElements()).toBe(2);
  expect(vectorStore.index?.getCurrentCount()).toBe(2);

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
  expect(vectorStore.index?.getMaxElements()).toBe(5);

  const resultTwo = await vectorStore.similaritySearchVectorWithScore(
    [1, 0, 0, 0],
    3
  );
  const resultTwoMetadatas = resultTwo.map(([{ metadata }]) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 4 }, { id: 6 }, { id: 5 }]);
});

test("Test HNSWLib.load and HNSWLib.save", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new FakeEmbeddings()
  );
  expect(vectorStore.index?.getCurrentCount()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  const resultOneMetadatas = resultOne.map(({ metadata }) => metadata);
  expect(resultOneMetadatas).toEqual([{ id: 3 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 2 }, { id: 1 }, { id: 3 }]);

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "lcjs-"));

  console.log(tempDirectory);

  await vectorStore.save(tempDirectory);

  const loadedVectorStore = await HNSWLib.load(
    tempDirectory,
    new FakeEmbeddings()
  );

  const resultThree = await loadedVectorStore.similaritySearch(
    "hello world",
    1
  );

  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas).toEqual([{ id: 3 }]);

  const resultFour = await loadedVectorStore.similaritySearch("hello world", 3);

  const resultFourMetadatas = resultFour.map(({ metadata }) => metadata);
  expect(resultFourMetadatas).toEqual([{ id: 2 }, { id: 1 }, { id: 3 }]);
});
