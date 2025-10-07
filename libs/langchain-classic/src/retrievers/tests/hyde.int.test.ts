import { expect, test } from "vitest";

import { OpenAIEmbeddings, OpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { HydeRetriever } from "../hyde.js";

test("Hyde retriever", async () => {
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = new MemoryVectorStore(embeddings);
  const llm = new OpenAI();
  const retriever = new HydeRetriever({
    vectorStore,
    llm,
    k: 1,
  });

  await vectorStore.addDocuments(
    [
      "My name is John.",
      "My name is Bob.",
      "My favourite food is pizza.",
      "My favourite food is pasta.",
    ].map((pageContent) => new Document({ pageContent }))
  );

  const results = await retriever.invoke("What is my favourite food?");

  expect(results.length).toBe(1);
  // console.log(results);
});

test("Hyde retriever with default prompt template", async () => {
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = new MemoryVectorStore(embeddings);
  const llm = new OpenAI();
  const retriever = new HydeRetriever({
    vectorStore,
    llm,
    k: 1,
    promptTemplate: "websearch",
  });

  await vectorStore.addDocuments(
    [
      "My name is John.",
      "My name is Bob.",
      "My favourite food is pizza.",
      "My favourite food is pasta.",
    ].map((pageContent) => new Document({ pageContent }))
  );

  const results = await retriever.invoke("What is my favourite food?");

  expect(results.length).toBe(1);
  // console.log(results);
});
