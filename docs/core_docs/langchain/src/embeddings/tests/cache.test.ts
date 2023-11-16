import { test, expect } from "@jest/globals";
import { Embeddings } from "../base.js";
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
