import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { v4 as uuidV4 } from "uuid";
import { MemoryVectorStore } from "../../../../vectorstores/memory.js";
import { AdaptiveRetrieval } from "../adaptive_retrieval.js";

test("AdaptiveRetrieval can retrieve", async () => {
  const smallEmbeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    dimensions: 512, // Min num for small
  });
  const largeEmbeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-large",
    dimensions: 3072, // Max num for large
  });

  const smallStore = new MemoryVectorStore(smallEmbeddings);
  const largeStore = new MemoryVectorStore(largeEmbeddings);

  const retriever = new AdaptiveRetrieval({
    smallStore,
    largeStore,
  });

  const irrelevantDocs = Array.from({ length: 250 }).map(
    () =>
      new Document({
        pageContent: faker.lorem.paragraph(5),
        metadata: { id: uuidV4() },
      })
  );
  const relevantDocIds = Array.from({ length: 5 }).map(() => uuidV4());
  const relevantDocs = [
    new Document({
      pageContent: "LangChain is an open source github repo",
      metadata: { id: relevantDocIds[0] },
    }),
    new Document({
      pageContent: "There are JS and PY versions of the LangChain github repos",
      metadata: { id: relevantDocIds[1] },
    }),
    new Document({
      pageContent:
        "LangGraph is a new open source library by the LangChain team",
      metadata: { id: relevantDocIds[2] },
    }),
    new Document({
      pageContent: "LangChain announced GA of LangSmith last week!",
      metadata: { id: relevantDocIds[3] },
    }),
    new Document({
      pageContent: "I heart LangChain",
      metadata: { id: relevantDocIds[4] },
    }),
  ];
  const allDocs = [...irrelevantDocs, ...relevantDocs];
  await retriever.addDocuments(allDocs);

  const query = "What is LangChain?";
  const results = await retriever.getRelevantDocuments(query);
  console.log(results.map((doc) => doc.pageContent));
  expect(results.length).toBe(5);
  expect(new Set(results.map((doc) => doc.metadata.id))).toEqual(
    new Set(relevantDocIds)
  );
});
