import { test, expect } from "@jest/globals";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { HNSWLib } from "../hnswlib";
import { OpenAIEmbeddings } from "../../embeddings";

test("Test HNSWLib.fromTexts", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );
  expect(vectorStore.index?.getCurrentCount()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  expect(resultOne).toEqual([{ id: 2 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  expect(resultTwo).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
});

test("Test HNSWLib.load and HNSWLib.save", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );
  expect(vectorStore.index?.getCurrentCount()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  expect(resultOne).toEqual([{ id: 2 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  expect(resultTwo).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "lcjs-"));

  console.log(tempDirectory);

  await vectorStore.save(tempDirectory);

  const loadedVectorStore = await HNSWLib.load(
    tempDirectory,
    new OpenAIEmbeddings()
  );

  const resultThree = await loadedVectorStore.similaritySearch(
    "hello world",
    1
  );

  expect(resultThree).toEqual([{ id: 2 }]);

  const resultFour = await loadedVectorStore.similaritySearch("hello world", 3);

  expect(resultFour).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
});
