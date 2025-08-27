import { test, expect } from "vitest";

import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

import { MemoryVectorStore } from "../../vectorstores/memory.js";

test("Test Memory Retriever with Callback", async () => {
  const pageContent = "Hello world";
  const embeddings = new FakeEmbeddings();

  const vectorStore = new MemoryVectorStore(embeddings);

  expect(vectorStore).toBeDefined();

  await vectorStore.addDocuments([
    { pageContent, metadata: { a: 1 } },
    { pageContent, metadata: { a: 1 } },
    { pageContent, metadata: { a: 1 } },
    { pageContent, metadata: { a: 1 } },
  ]);

  const queryStr = "testing testing";
  let startRun = 0;
  let endRun = 0;
  let startPromiseResolve: (v?: unknown) => void;
  const startPromise = new Promise((resolve) => {
    startPromiseResolve = resolve;
  });
  let endPromiseResolve: (v?: unknown) => void;
  const endPromise = new Promise((resolve) => {
    endPromiseResolve = resolve;
  });

  const retriever = vectorStore.asRetriever({
    k: 1,
    vectorStore,
    callbacks: [
      {
        handleRetrieverStart: async (_, query) => {
          expect(query).toBe(queryStr);
          startRun += 1;
          startPromiseResolve();
        },
        handleRetrieverEnd: async (documents) => {
          expect(documents[0].pageContent).toBe(pageContent);
          endRun += 1;
          endPromiseResolve();
        },
      },
    ],
  });

  const results = await retriever.getRelevantDocuments(queryStr);

  expect(results).toEqual([new Document({ metadata: { a: 1 }, pageContent })]);
  await startPromise;
  await endPromise;
  expect(startRun).toBe(1);
  expect(endRun).toBe(1);
});
