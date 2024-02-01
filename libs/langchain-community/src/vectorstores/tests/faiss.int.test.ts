import { test, expect } from "@jest/globals";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { FaissStore } from "../faiss.js";

test("Test FaissStore.fromTexts", async () => {
  const vectorStore = await FaissStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );
  expect(vectorStore.index?.ntotal()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  const resultOneMetadatas = resultOne.map(({ metadata }) => metadata);
  expect(resultOneMetadatas).toEqual([{ id: 2 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
});

test("Test FaissStore.fromTexts + addDocuments", async () => {
  const vectorStore = await FaissStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );
  expect(vectorStore.index?.ntotal()).toBe(3);

  await vectorStore.addDocuments([
    new Document({
      pageContent: "hello worldklmslksmn",
      metadata: { id: 4 },
    }),
  ]);
  expect(vectorStore.index?.ntotal()).toBe(4);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }]);
});

test("Test FaissStore.load and FaissStore.save", async () => {
  const vectorStore = await FaissStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );
  expect(vectorStore.index?.ntotal()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  const resultOneMetadatas = resultOne.map(({ metadata }) => metadata);
  expect(resultOneMetadatas).toEqual([{ id: 2 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "lcjs-"));

  console.log(tempDirectory);

  await vectorStore.save(tempDirectory);

  const loadedVectorStore = await FaissStore.load(
    tempDirectory,
    new OpenAIEmbeddings()
  );

  const resultThree = await loadedVectorStore.similaritySearch(
    "hello world",
    1
  );

  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas).toEqual([{ id: 2 }]);

  const resultFour = await loadedVectorStore.similaritySearch("hello world", 3);

  const resultFourMetadatas = resultFour.map(({ metadata }) => metadata);
  expect(resultFourMetadatas).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
});

test("Test FaissStore.loadFromPython", async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const loadedFromPythonVectorStore = await FaissStore.loadFromPython(
    path.join(__dirname, "faiss.int.test.data/faiss_index"),
    new OpenAIEmbeddings()
  );
  expect(loadedFromPythonVectorStore.index?.ntotal()).toBe(42);

  const results0 = await loadedFromPythonVectorStore.similaritySearch(
    "What did the president say about Ketanji Brown Jackson"
  );

  const expectedResultofPythonSaved = new Document({
    metadata: { source: "../../../../../examples/state_of_the_union.txt" },
    pageContent: `Tonight. I call on the Senate to: Pass the Freedom to Vote Act. Pass the John Lewis Voting Rights Act. And while you’re at it, pass the Disclose Act so Americans can know who is funding our elections. 

Tonight, I’d like to honor someone who has dedicated his life to serve this country: Justice Stephen Breyer—an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. Justice Breyer, thank you for your service. 

One of the most serious constitutional responsibilities a President has is nominating someone to serve on the United States Supreme Court. 

And I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence.`,
  });

  expect(results0).toHaveLength(4);

  expect(results0[0]).toEqual(expectedResultofPythonSaved);

  await loadedFromPythonVectorStore.addDocuments([
    new Document({
      metadata: {
        source: "addDocuments_0",
      },
      pageContent: "hello",
    }),
    new Document({
      metadata: {
        source: "addDocuments_1",
      },
      pageContent: "你好吗？",
    }),
    new Document({
      metadata: {
        source: "addDocuments_2",
      },
      pageContent: "おはようございます。",
    }),
    new Document({
      metadata: {
        source: "addDocuments_3",
      },
      pageContent: "こんにちは！",
    }),
  ]);

  const results1 = await loadedFromPythonVectorStore.similaritySearch("hello");

  expect(results1).toEqual([
    new Document({
      pageContent: "hello",
      metadata: { source: "addDocuments_0" },
    }),
    new Document({
      pageContent: "こんにちは！",
      metadata: { source: "addDocuments_3" },
    }),
    new Document({
      pageContent: "你好吗？",
      metadata: { source: "addDocuments_1" },
    }),
    new Document({
      pageContent: "おはようございます。",
      metadata: { source: "addDocuments_2" },
    }),
  ]);

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "lcjs-"));

  console.log(tempDirectory);

  await loadedFromPythonVectorStore.save(tempDirectory);

  const loadedVectorStore = await FaissStore.load(
    tempDirectory,
    new OpenAIEmbeddings()
  );

  const results2 = await loadedVectorStore.similaritySearch("早上", 1);

  expect(results2).toHaveLength(1);

  expect(results2[0]).toEqual(
    new Document({
      pageContent: "おはようございます。",
      metadata: { source: "addDocuments_2" },
    })
  );

  const results3 = await loadedVectorStore.similaritySearch(
    "What did the president say about Ketanji Brown Jackson",
    1
  );

  expect(results3).toHaveLength(1);

  expect(results3[0]).toEqual(expectedResultofPythonSaved);
});
