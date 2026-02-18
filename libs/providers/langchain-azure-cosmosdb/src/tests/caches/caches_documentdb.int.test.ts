/* eslint-disable @typescript-eslint/no-explicit-any */
import { it, expect, beforeEach, describe } from "vitest";
import {
  ChatOpenAI,
  OpenAIEmbeddings,
  type ChatOpenAIFields,
  type OpenAIEmbeddingsParams,
} from "@langchain/openai";
import { MongoClient } from "mongodb";
import { AzureDocumentDBSemanticCache } from "../../caches/caches_documentdb.js";
import {
  AzureDocumentDBIndexOptions,
  AzureDocumentDBSimilarityType,
} from "../../azure_documentdb.js";

function getEmbeddings(fields?: Partial<OpenAIEmbeddingsParams>) {
  return new OpenAIEmbeddings({
    model: process.env.OPENAI_EMBEDDINGS_MODEL,
    ...fields,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL,
    },
  });
}

function getChatModel(fields?: Partial<ChatOpenAIFields>) {
  return new ChatOpenAI({
    model: process.env.OPENAI_CHAT_MODEL,
    ...fields,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL,
    },
  });
}

const DATABASE_NAME = "langchain";
const COLLECTION_NAME = "test";

async function initializeCache(
  indexType: any,
  distanceFunction: any,
  similarityThreshold: number = 0.6
): Promise<AzureDocumentDBSemanticCache> {
  const embeddingModel = getEmbeddings();
  const testEmbedding = await embeddingModel.embedDocuments(["sample text"]);
  const dimension = testEmbedding[0].length;

  const indexOptions: AzureDocumentDBIndexOptions = {
    indexType,
    similarity:
      distanceFunction === "cosine"
        ? AzureDocumentDBSimilarityType.COS
        : distanceFunction === "euclidean"
          ? AzureDocumentDBSimilarityType.L2
          : AzureDocumentDBSimilarityType.IP,
    dimensions: dimension,
  };

  let cache: AzureDocumentDBSemanticCache;

  const connectionString =
    process.env.AZURE_DOCUMENTDB_CONNECTION_STRING ||
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING;
  if (connectionString) {
    cache = new AzureDocumentDBSemanticCache(
      embeddingModel,
      {
        databaseName: DATABASE_NAME,
        collectionName: COLLECTION_NAME,
        connectionString,
        indexOptions,
      },
      similarityThreshold
    );
  } else {
    throw new Error(
      "Please set the environment variable AZURE_DOCUMENTDB_CONNECTION_STRING"
    );
  }

  return cache;
}

describe("AzureDocumentDBSemanticCache", () => {
  beforeEach(async () => {
    const connectionString =
      process.env.AZURE_DOCUMENTDB_CONNECTION_STRING ||
      process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING;
    const client = new MongoClient(connectionString!);

    try {
      await client.db(DATABASE_NAME).collection(COLLECTION_NAME).drop();
    } catch (error) {
      throw new Error("Please set collection name here");
    }
  });

  it("should store and retrieve cache using cosine similarity with ivf index", async () => {
    const cache = await initializeCache("ivf", "cosine", 0.9);
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("What is the capital of France?", llmString, [
      { text: "Paris" },
    ]);

    let cacheOutput = await cache.lookup(
      "What is the capital of France?",
      llmString
    );
    expect(cacheOutput).toEqual([{ text: "Paris" }]);

    cacheOutput = await cache.lookup(
      "How do I bake chocolate chip cookies from scratch?",
      llmString
    );
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("should store and retrieve cache using euclidean similarity with hnsw index", async () => {
    const cache = await initializeCache("hnsw", "euclidean", 0.9);
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("What is the capital of France?", llmString, [
      { text: "Paris" },
    ]);

    let cacheOutput = await cache.lookup(
      "What is the capital of France?",
      llmString
    );
    expect(cacheOutput).toEqual([{ text: "Paris" }]);

    cacheOutput = await cache.lookup(
      "How do I bake chocolate chip cookies from scratch?",
      llmString
    );
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("should return null if similarity score is below threshold (cosine similarity with ivf index)", async () => {
    const cache = await initializeCache("ivf", "cosine", 0.8);
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("What is the capital of France?", llmString, [
      { text: "Paris" },
    ]);

    const cacheOutput = await cache.lookup(
      "What is the capital of France?",
      llmString
    );
    expect(cacheOutput).toEqual([{ text: "Paris" }]);

    const resultBelowThreshold = await cache.lookup(
      "How do I bake chocolate chip cookies from scratch?",
      llmString
    );
    expect(resultBelowThreshold).toEqual(null);

    await cache.clear(llmString);
  });

  it("should handle a variety of cache updates and lookups", async () => {
    const cache = await initializeCache("ivf", "cosine", 0.9);
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);

    await cache.update("What is the capital of France?", llmString, [
      { text: "Paris" },
    ]);
    await cache.update("How do I train my dog to sit on command?", llmString, [
      { text: "Use positive reinforcement" },
    ]);

    let cacheOutput = await cache.lookup(
      "What is the capital of France?",
      llmString
    );
    expect(cacheOutput).toEqual([{ text: "Paris" }]);

    cacheOutput = await cache.lookup(
      "How do I train my dog to sit on command?",
      llmString
    );
    expect(cacheOutput).toEqual([{ text: "Use positive reinforcement" }]);

    cacheOutput = await cache.lookup(
      "How do I bake chocolate chip cookies from scratch?",
      llmString
    );
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });
});
