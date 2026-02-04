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
      getEmbeddings(),
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
    const cache = await initializeCache("ivf", "cosine");
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("should store and retrieve cache using euclidean similarity with hnsw index", async () => {
    const cache = await initializeCache("hnsw", "euclidean");
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("should return null if similarity score is below threshold (cosine similarity with ivf index)", async () => {
    const cache = await initializeCache("ivf", "cosine", 0.8);
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    const cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    const resultBelowThreshold = await cache.lookup("bar", llmString);
    expect(resultBelowThreshold).toEqual(null);

    await cache.clear(llmString);
  });

  it("should handle a variety of cache updates and lookups", async () => {
    const cache = await initializeCache("ivf", "cosine", 0.7);
    const model = getChatModel({ model: "gpt-4o-mini", cache });
    const llmString = JSON.stringify(model._identifyingParams);

    await cache.update("test1", llmString, [{ text: "response 1" }]);
    await cache.update("test2", llmString, [{ text: "response 2" }]);

    let cacheOutput = await cache.lookup("test1", llmString);
    expect(cacheOutput).toEqual([{ text: "response 1" }]);

    cacheOutput = await cache.lookup("test2", llmString);
    expect(cacheOutput).toEqual([{ text: "response 2" }]);

    cacheOutput = await cache.lookup("test3", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });
});
