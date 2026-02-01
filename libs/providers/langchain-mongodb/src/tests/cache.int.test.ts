import { test, expect } from "@jest/globals";
import { MongoClient, Collection } from "mongodb";
import { Generation } from "@langchain/core/outputs";
import { MongoDBCache, MongoDBAtlasSemanticCache } from "../cache.js";
import { uri, waitForIndexToBeQueryable } from "./utils.js";

class TestEmbeddings {
  async embedQuery(text: string): Promise<number[]> {
    if (text === "What is the capital of France?") {
      // Similar prompts: close vectors
      return [0.1, 0.2, 0.3, 0.4, 0.5];
    } else if (text === "Name the capital city of France.") {
      // Similar prompts: close vectors
      return [0.1001, 0.2, 0.3, 0.4, 0.5];
    }
    // Dissimilar prompt
    return [0.01, -0.01, 0.01, -0.01, 0.01];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedQuery(t)));
  }
}

let client: MongoClient;
let kvCollection: Collection;
let semanticCollection: Collection;

beforeAll(async () => {
  client = new MongoClient(uri());
  await client.connect();

  const kvNamespace = "langchain_test.kv_cache";
  const semanticNamespace = "langchain_test.semantic_cache";
  const [kvDbName, kvCollectionName] = kvNamespace.split(".");
  const [semanticDbName, semanticCollectionName] = semanticNamespace.split(".");

  kvCollection = await client.db(kvDbName).createCollection(kvCollectionName);
  semanticCollection = await client
    .db(semanticDbName)
    .createCollection(semanticCollectionName);

  await semanticCollection.createSearchIndex({
    name: "default",
    definition: {
      mappings: {
        dynamic: true,
        fields: {
          embedding: { dimensions: 5, similarity: "cosine", type: "knnVector" },
        },
      },
    },
  });
  await waitForIndexToBeQueryable(semanticCollection, "default");
}, 60000);

beforeEach(async () => {
  await semanticCollection.deleteMany({});
});

afterAll(async () => {
  await client.close();
});

test("MongoDBCache: stores and retrieves generations", async () => {
  const cache = new MongoDBCache({ collection: kvCollection });
  const prompt = "What is the capital of France?";
  const llmKey = "openai:gpt-3.5";
  const generations: Generation[] = [{ text: "Paris" }];

  await cache.update(prompt, llmKey, generations);
  const result = await cache.lookup(prompt, llmKey);
  expect(result).toEqual(generations);

  const miss = await cache.lookup("unknown prompt", llmKey);
  expect(miss).toBeNull();

  await cache.clear({ llm: llmKey });
  const afterClear = await cache.lookup(prompt, llmKey);
  expect(afterClear).toBeNull();
});

test("MongoDBAtlasSemanticCache: caches and retrieves a prompt", async () => {
  const embeddings = new TestEmbeddings();
  const cache = new MongoDBAtlasSemanticCache(semanticCollection, embeddings, {
    scoreThreshold: 0.99,
    waitUntilReady: 1,
  });

  const prompt = "What is the capital of France?";
  const llmKey = "test-llm";
  const gen = [{ text: "Paris" }];

  await cache.update(prompt, llmKey, gen);
  await waitForIndexToBeQueryable(semanticCollection, "default");
  const result = await cache.lookup(prompt, llmKey);
  expect(result?.[0].text).toBe("Paris");
});

test("MongoDBAtlasSemanticCache: similar prompts share cache", async () => {
  const embeddings = new TestEmbeddings();
  const cache = new MongoDBAtlasSemanticCache(semanticCollection, embeddings, {
    scoreThreshold: 0.99,
    waitUntilReady: 1,
  });

  const prompt1 = "What is the capital of France?";
  const prompt2 = "Name the capital city of France.";
  const llmKey = "test-llm";
  const gen = [{ text: "Paris" }];

  await cache.update(prompt1, llmKey, gen);
  await waitForIndexToBeQueryable(semanticCollection, "default");
  const result = await cache.lookup(prompt2, llmKey);
  expect(result?.[0].text).toBe("Paris");
});

test("MongoDBAtlasSemanticCache: dissimilar prompts do not share cache", async () => {
  const embeddings = new TestEmbeddings();
  const cache = new MongoDBAtlasSemanticCache(semanticCollection, embeddings, {
    scoreThreshold: 0.99,
    waitUntilReady: 1,
  });

  const prompt1 = "What is the capital of France?";
  const prompt3 = "What is the tallest mountain?";
  const llmKey = "test-llm";
  const gen1 = [{ text: "Paris" }];
  const gen3 = [{ text: "Mount Everest" }];

  await cache.update(prompt1, llmKey, gen1);
  await cache.update(prompt3, llmKey, gen3);
  await waitForIndexToBeQueryable(semanticCollection, "default");
  const result = await cache.lookup(prompt3, llmKey);
  expect(result?.[0].text).toBe("Mount Everest");
});
