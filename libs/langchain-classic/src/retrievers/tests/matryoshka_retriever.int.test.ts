import { test, expect } from "vitest";

import { v4 as uuidV4 } from "uuid";

import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";

import { MatryoshkaRetriever } from "../matryoshka_retriever.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";

test("MatryoshkaRetriever can retrieve", async () => {
  const smallEmbeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    dimensions: 512, // Min num for small
  });
  const largeEmbeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    dimensions: 3072, // Max num for large
  });

  const vectorStore = new MemoryVectorStore(smallEmbeddings);

  const retriever = new MatryoshkaRetriever({
    largeEmbeddingModel: largeEmbeddings,
    vectorStore,
    largeK: 5,
  });

  const irrelevantDocs = Array.from({ length: 250 }).map(
    () =>
      new Document({
        pageContent:
          "debitis consectetur voluptatem non doloremque ipsum autem totam eum ratione",
        metadata: { id: uuidV4() },
      })
  );
  const relevantDocContents = [
    "LangChain is an open source github repo",
    "There are JS and PY versions of the LangChain github repos",
    "LangGraph is a new open source library by the LangChain team",
    "LangChain announced GA of LangSmith last week!",
    "I heart LangChain",
  ];
  const relevantDocs = [
    new Document({
      pageContent: relevantDocContents[0],
      metadata: { id: uuidV4() },
    }),
    new Document({
      pageContent: relevantDocContents[1],
      metadata: { id: uuidV4() },
    }),
    new Document({
      pageContent: relevantDocContents[2],
      metadata: { id: uuidV4() },
    }),
    new Document({
      pageContent: relevantDocContents[3],
      metadata: { id: uuidV4() },
    }),
    new Document({
      pageContent: relevantDocContents[4],
      metadata: { id: uuidV4() },
    }),
  ];
  const allDocs = [...irrelevantDocs, ...relevantDocs];

  await retriever.addDocuments(allDocs);

  const query = "What is LangChain?";
  // console.log("Querying documents");
  const results = await retriever.invoke(query);

  const retrieverResultContents = new Set(
    results.map((doc) => doc.pageContent)
  );

  // console.log([...retrieverResultContents]);
  expect(results.length).toBe(5);
  expect(retrieverResultContents).toEqual(new Set(relevantDocContents));
});

test("Can change number of docs returned (largeK)", async () => {
  const smallEmbeddings = new SyntheticEmbeddings({
    vectorSize: 512,
  });
  const largeEmbeddings = new SyntheticEmbeddings({
    vectorSize: 3072,
  });

  const vectorStore = new MemoryVectorStore(smallEmbeddings);

  const docsWithId = Array.from({ length: 10 }).map(
    () =>
      new Document({
        pageContent: "hello world",
        metadata: { id: uuidV4() },
      })
  );
  const retriever = new MatryoshkaRetriever({
    largeEmbeddingModel: largeEmbeddings,
    vectorStore,
    largeK: 10,
  });

  await retriever.addDocuments(docsWithId);

  const query = "hello world";
  const results = await retriever.invoke(query);
  expect(results.length).toBe(10);
});

test("AddDocunents adds large embeddings metadata field", async () => {
  const testId = uuidV4();
  const doc = new Document({
    pageContent: "hello world",
    metadata: { id: testId },
  });

  const smallEmbeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    dimensions: 512, // Min num for small
  });
  const largeEmbeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    dimensions: 3072, // Max num for large
  });

  const vectorStore = new MemoryVectorStore(smallEmbeddings);

  const retriever = new MatryoshkaRetriever({
    largeEmbeddingModel: largeEmbeddings,
    vectorStore,
  });

  await retriever.addDocuments([doc]);

  const relevantDocs = await retriever.invoke("hello world");
  expect(relevantDocs[0].metadata.id).toBe(testId);
  expect(relevantDocs[0].metadata[retriever.largeEmbeddingKey]).toBeDefined();
  expect(
    JSON.parse(relevantDocs[0].metadata[retriever.largeEmbeddingKey]).length
  ).toBe(3072);
});
