import { Document } from "../../document.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { FaissStore } from "../../vectorstores/faiss.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";

test("Test HNSWLib Retriever with Callback", async () => {
  const pageContent = "Hello world";

  const vectorStore = await HNSWLib.fromTexts(
    [pageContent, pageContent, pageContent],
    [{ id: 2 }, { id: 3 }, { id: 4 }],
    new FakeEmbeddings()
  );

  const queryStr = "testing testing";
  let startRun = 0;
  let endRun = 0;

  const retriever = vectorStore.asRetriever({
    k: 1,
    vectorStore,
    callbacks: [
      {
        handleRetrieverStart: async (_, query) => {
          expect(query).toBe(queryStr);
          startRun += 1;
        },
        handleRetrieverEnd: async (documents) => {
          expect(documents[0].pageContent).toBe(pageContent);
          endRun += 1;
        },
      },
    ],
  });

  const results = await retriever.getRelevantDocuments(queryStr);

  expect(results).toEqual([new Document({ metadata: { id: 4 }, pageContent })]);
  expect(startRun).toBe(1);
  expect(endRun).toBe(1);
});

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

  const retriever = vectorStore.asRetriever({
    k: 1,
    vectorStore,
    callbacks: [
      {
        handleRetrieverStart: async (_, query) => {
          expect(query).toBe(queryStr);
          startRun += 1;
        },
        handleRetrieverEnd: async (documents) => {
          expect(documents[0].pageContent).toBe(pageContent);
          endRun += 1;
        },
      },
    ],
  });

  const results = await retriever.getRelevantDocuments(queryStr);

  expect(results).toEqual([new Document({ metadata: { a: 1 }, pageContent })]);
  expect(startRun).toBe(1);
  expect(endRun).toBe(1);
});

test("Test Faiss Retriever with Callback", async () => {
  const pageContent = "Hello world";
  const embeddings = new FakeEmbeddings();

  const vectorStore = await FaissStore.fromTexts(
    [pageContent],
    [{ a: 1 }],
    embeddings
  );

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

  const retriever = vectorStore.asRetriever({
    k: 1,
    vectorStore,
    callbacks: [
      {
        handleRetrieverStart: async (_, query) => {
          expect(query).toBe(queryStr);
          startRun += 1;
        },
        handleRetrieverEnd: async (documents) => {
          expect(documents[0].pageContent).toBe(pageContent);
          endRun += 1;
        },
      },
    ],
  });

  const results = await retriever.getRelevantDocuments(queryStr);

  expect(results).toEqual([new Document({ metadata: { a: 1 }, pageContent })]);
  expect(startRun).toBe(1);
  expect(endRun).toBe(1);
});
