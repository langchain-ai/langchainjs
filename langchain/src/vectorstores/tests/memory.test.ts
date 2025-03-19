import { test, expect } from "@jest/globals";

import { Document, DocumentInterface } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { MemoryVectorStore } from "../memory.js";
import { cosine } from "../../util/ml-distance/similarities.js";

test("MemoryVectorStore with external ids", async () => {
  const embeddings = new SyntheticEmbeddings({
    vectorSize: 1536,
  });

  const store = new MemoryVectorStore(embeddings);

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);
});

test("MemoryVectorStore stores and retrieves document IDs", async () => {
  const embeddings = new SyntheticEmbeddings({
    vectorSize: 1536,
  });
  const store = new MemoryVectorStore(embeddings);

  const filterFunc = (doc: DocumentInterface): boolean => {
    const { metadata } = doc;
    if (metadata.namespace <= 2) {
      return true;
    }
    return false;
  };

  const retriever = store.asRetriever({
    k: 2,
    filter: filterFunc,
  });

  expect(retriever).toBeDefined();

  await retriever.addDocuments([
    { pageContent: "hello", metadata: { namespace: 1 }, id: "1" },
    { pageContent: "hello", metadata: { namespace: 2 }, id: "2" },
    { pageContent: "hello", metadata: { namespace: 3 }, id: "3" },
    { pageContent: "hello", metadata: { namespace: 4 }, id: "4" },
  ]);

  const results = await retriever.getRelevantDocuments("hello");

  expect(results).toHaveLength(2);

  expect(results).toEqual([
    new Document({ metadata: { namespace: 1 }, pageContent: "hello", id: "1" }),
    new Document({ metadata: { namespace: 2 }, pageContent: "hello", id: "2" }),
  ]);
});

test("MemoryVectorStore as retriever can filter metadata", async () => {
  const embeddings = new SyntheticEmbeddings({
    vectorSize: 1536,
  });
  const store = new MemoryVectorStore(embeddings);

  const filterFunc = (doc: DocumentInterface): boolean => {
    const { metadata } = doc;
    if (metadata.namespace <= 2) {
      return true;
    }
    return false;
  };

  const retriever = store.asRetriever({
    k: 2,
    filter: filterFunc,
  });

  expect(retriever).toBeDefined();

  await retriever.addDocuments([
    { pageContent: "hello", metadata: { namespace: 1 } },
    { pageContent: "hello", metadata: { namespace: 2 } },
    { pageContent: "hello", metadata: { namespace: 3 } },
    { pageContent: "hello", metadata: { namespace: 4 } },
  ]);

  const results = await retriever.getRelevantDocuments("hello");

  expect(results).toHaveLength(2);

  expect(results).toEqual([
    new Document({ metadata: { namespace: 1 }, pageContent: "hello" }),
    new Document({ metadata: { namespace: 2 }, pageContent: "hello" }),
  ]);
});

test("MemoryVectorStore with custom similarity", async () => {
  const embeddings = new SyntheticEmbeddings({
    vectorSize: 1536,
  });
  let similarityCalled = false;
  let similarityCalledCount = 0;
  const store = new MemoryVectorStore(embeddings, {
    similarity: (a: number[], b: number[]) => {
      similarityCalledCount += 1;
      similarityCalled = true;
      return cosine(a, b);
    },
  });

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.similaritySearch("hello", 3);

  expect(similarityCalled).toBe(true);
  expect(similarityCalledCount).toBe(4);
  expect(results).toHaveLength(3);
});

test("MemoryVectorStore with max marginal relevance", async () => {
  const embeddings = new SyntheticEmbeddings({
    vectorSize: 1536,
  });
  let similarityCalled = false;
  let similarityCalledCount = 0;
  const store = new MemoryVectorStore(embeddings, {
    similarity: (a: number[], b: number[]) => {
      similarityCalledCount += 1;
      similarityCalled = true;
      return cosine(a, b);
    },
  });

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.maxMarginalRelevanceSearch("hello", { k: 3 });

  expect(similarityCalled).toBe(true);
  expect(similarityCalledCount).toBe(4);
  expect(results).toHaveLength(3);
});
