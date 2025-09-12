import { test, expect } from "@jest/globals";
import { Embeddings } from "@langchain/core/embeddings";
import { CacheBackedEmbeddings } from "../cache_backed.js";
import { InMemoryStore } from "../../storage/in_memory.js";

class RandomEmbeddings extends Embeddings {
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const quoteUnquoteEmbeddings = [];
    for (const document of documents) {
      quoteUnquoteEmbeddings.push(await this.embedQuery(document));
    }
    return quoteUnquoteEmbeddings;
  }

  async embedQuery(_document: string): Promise<number[]> {
    return [Math.random(), Math.random()];
  }
}

test("Basic embeddings cache", async () => {
  const embeddingsCache = CacheBackedEmbeddings.fromBytesStore(
    new RandomEmbeddings({}),
    new InMemoryStore()
  );
  const documents = ["How are you?", "I am fine", "I am LangChain"];
  const result = await embeddingsCache.embedDocuments(documents);
  expect(result.findIndex((v) => v === undefined)).toEqual(-1);
  const result2 = await embeddingsCache.embedDocuments(documents);
  expect(result).toEqual(result2);
});

test("Query caching works correctly", async () => {
  const queryStore = new InMemoryStore();
  const embeddingsCache = CacheBackedEmbeddings.fromBytesStore(
    new RandomEmbeddings({}),
    new InMemoryStore(),
    { queryEmbeddingStore: queryStore }
  );

  const query = "What is AI?";

  // First call: Embed and cache
  const firstEmbedding = await embeddingsCache.embedQuery(query);
  expect(firstEmbedding.length).toBeGreaterThan(0);

  // Second call: Retrieve from cache
  const cachedEmbedding = await embeddingsCache.embedQuery(query);
  expect(firstEmbedding).toEqual(cachedEmbedding);
});

test("Document and query caches remain separate", async () => {
  const documentStore = new InMemoryStore();
  const queryStore = new InMemoryStore();
  const embeddingsCache = CacheBackedEmbeddings.fromBytesStore(
    new RandomEmbeddings({}),
    documentStore,
    { queryEmbeddingStore: queryStore }
  );

  const document = "How does LangChain work?";
  const query = "What is AI?";

  // Store query embedding
  const queryEmbedding = await embeddingsCache.embedQuery(query);

  // Store document embedding
  const documentEmbedding = await embeddingsCache.embedDocuments([document]);

  // Retrieve again via embeddingsCache to ensure cache is used
  const cachedQueryEmbedding = await embeddingsCache.embedQuery(query);
  const cachedDocumentEmbedding = (
    await embeddingsCache.embedDocuments([document])
  )[0];

  expect(cachedQueryEmbedding).toEqual(queryEmbedding);
  expect(cachedDocumentEmbedding).toEqual(documentEmbedding[0]);
});

test("Cache handles missing values properly", async () => {
  const queryStore = new InMemoryStore();
  const embeddingsCache = CacheBackedEmbeddings.fromBytesStore(
    new RandomEmbeddings({}),
    new InMemoryStore(),
    { queryEmbeddingStore: queryStore }
  );

  const query = "Explain embeddings";

  // First call: should compute and cache the embedding
  const embedding1 = await embeddingsCache.embedQuery(query);
  expect(embedding1.length).toBeGreaterThan(0);

  // Second call: should retrieve from cache (should be equal)
  const embedding2 = await embeddingsCache.embedQuery(query);
  expect(embedding2).toEqual(embedding1);
});
