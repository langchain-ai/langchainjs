import { test, expect } from "vitest";

import { Document, DocumentInterface } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { Embeddings } from "@langchain/core/embeddings";

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

  const results = await retriever.invoke("hello");

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

  const results = await retriever.invoke("hello");

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

test("MemoryVectorStore sorts results in descending order of similarity", async () => {
  const embeddings = new Map<string, number[]>([
    ["Document A", [0]],
    ["Document B", [1]],
    ["Document C", [2]],
    ["Document D", [3]],
  ]);

  const reverseEmbeddings = new Map<number[], string>(
    Array.from(embeddings.entries()).map(([key, value]) => [value, key])
  );
  class ContrivedEmbeddings extends Embeddings {
    async embedDocuments(documents: string[]): Promise<number[][]> {
      return documents.map((text) => embeddings.get(text)!);
    }

    async embedQuery(text: string): Promise<number[]> {
      if (!embeddings.has(text)) {
        throw new Error(`Document ${text} not found`);
      }
      return embeddings.get(text)!;
    }
  }

  function* permutations<T>(items: T[]): Generator<T[]> {
    if (items.length <= 1) {
      yield [...items];
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const rest = [...items.slice(0, i), ...items.slice(i + 1)];
      for (const perm of permutations(rest)) {
        yield [items[i], ...perm];
      }
    }
  }

  function similarity(query: number[], vector: number[]): number {
    const queryText = reverseEmbeddings.get(query);
    if (queryText !== "Document D") {
      throw new Error(`Similarity metric only valid for Document D`);
    }
    const docText = reverseEmbeddings.get(vector);

    switch (docText) {
      case "Document A":
        return 0.23351;
      case "Document B":
        return 0.062168;
      case "Document C":
        return 0.169842;
      default:
        return 0;
    }
  }

  for (const documentOrdering of permutations([
    "Document A",
    "Document B",
    "Document C",
  ])) {
    const store = new MemoryVectorStore(new ContrivedEmbeddings({}), {
      similarity,
    });

    // Add documents with dummy embeddings
    for (const document of documentOrdering) {
      await store.addDocuments([{ pageContent: document, metadata: { a: 1 } }]);
    }

    const results = await store.similaritySearchWithScore("Document D", 3);

    // Get the IDs in the order they were returned
    const resultOrder = results.map(([{ pageContent }]) => pageContent);

    // Get the similarity scores
    const similarityScores = results.map(([, score]) => score);

    // With the correct sorting logic, we would expect:
    const expectedOrder = ["Document A", "Document C", "Document B"];

    // This expectation might fail with the current implementation
    // because .sort((a, b) => (a.similarity > b.similarity ? -1 : 0)) is broken
    expect(resultOrder).toEqual(expectedOrder);

    // The similarity scores should be in descending order
    expect(similarityScores[0]).toBeGreaterThan(similarityScores[1]);
    expect(similarityScores[1]).toBeGreaterThan(similarityScores[2]);
  }
});
