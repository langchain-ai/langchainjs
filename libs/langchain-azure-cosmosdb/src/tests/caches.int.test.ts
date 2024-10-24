/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  CosmosClient,
  IndexingMode,
  VectorEmbeddingPolicy,
} from "@azure/cosmos";
import { FakeEmbeddings, FakeLLM } from "@langchain/core/utils/testing";
import { DefaultAzureCredential } from "@azure/identity";
import { AzureCosmosDBNoSQLSemanticCache } from "../caches.js";

const DATABASE_NAME = "langchainTestCacheDB";
const CONTAINER_NAME = "testContainer";

function indexingPolicy(indexType: any) {
  return {
    indexingMode: IndexingMode.consistent,
    includedPaths: [{ path: "/*" }],
    excludedPaths: [{ path: '/"_etag"/?' }],
    vectorIndexes: [{ path: "/embedding", type: indexType }],
  };
}

function vectorEmbeddingPolicy(
  distanceFunction: "euclidean" | "cosine" | "dotproduct"
): VectorEmbeddingPolicy {
  return {
    vectorEmbeddings: [
      {
        path: "/embedding",
        dataType: "float32",
        distanceFunction,
        dimensions: 0,
      },
    ],
  };
}

function initializeCache(
  indexType: any,
  distanceFunction: any
): AzureCosmosDBNoSQLSemanticCache {
  let cache: AzureCosmosDBNoSQLSemanticCache;
  if (process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING) {
    cache = new AzureCosmosDBNoSQLSemanticCache(new FakeEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
      connectionString: process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING,
      indexingPolicy: indexingPolicy(indexType),
      vectorEmbeddingPolicy: vectorEmbeddingPolicy(distanceFunction),
    });
  } else if (process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT) {
    cache = new AzureCosmosDBNoSQLSemanticCache(new FakeEmbeddings(), {
      databaseName: DATABASE_NAME,
      containerName: CONTAINER_NAME,
      endpoint: process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT,
      indexingPolicy: indexingPolicy(indexType),
      vectorEmbeddingPolicy: vectorEmbeddingPolicy(distanceFunction),
    });
  } else {
    throw new Error(
      "Please set the environment variable AZURE_COSMOSDB_NOSQL_CONNECTION_STRING or AZURE_COSMOSDB_NOSQL_ENDPOINT"
    );
  }
  return cache;
}

/*
 * To run this test, you need have an Azure Cosmos DB for NoSQL instance
 * running. You can deploy a free version on Azure Portal without any cost,
 * following this guide:
 * https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
 *
 * You do not need to create a database or collection, it will be created
 * automatically by the test.
 *
 * Once you have the instance running, you need to set the following environment
 * variables before running the test:
 * - AZURE_COSMOSDB_NOSQL_CONNECTION_STRING or AZURE_COSMOSDB_NOSQL_ENDPOINT
 */
describe("Azure CosmosDB NoSQL Semantic Cache", () => {
  beforeEach(async () => {
    let client: CosmosClient;

    if (process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING) {
      client = new CosmosClient(
        process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING
      );
    } else if (process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT) {
      client = new CosmosClient({
        endpoint: process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT,
        aadCredentials: new DefaultAzureCredential(),
      });
    } else {
      throw new Error(
        "Please set the environment variable AZURE_COSMOSDB_NOSQL_CONNECTION_STRING or AZURE_COSMOSDB_NOSQL_ENDPOINT"
      );
    }

    // Make sure the database does not exists
    try {
      await client.database(DATABASE_NAME).delete();
    } catch {
      // Ignore error if the database does not exist
    }
  });
  it("test AzureCosmosDBNoSqlSemanticCache with cosine quantizedFlat", async () => {
    const cache = initializeCache("quantizedFlat", "cosine");
    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());
    await cache.update("foo", llmString, [{ text: "fizz" }]);
    const cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);
    await cache.clear(llmString);
  });
  it("test AzureCosmosDBNoSqlSemanticCache with cosine flat", async () => {
    const cache = initializeCache("flat", "cosine");
    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());
    await cache.update("foo", llmString, [{ text: "Buzz" }]);
    const cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual([{ text: "Buzz" }]);
    await cache.clear(llmString);
  });
  it("test AzureCosmosDBNoSqlSemanticCache with dotProduct quantizedFlat", async () => {
    const cache = initializeCache("quantizedFlat", "dotproduct");
    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());
    await cache.update("foo", llmString, [{ text: "fizz" }, { text: "Buzz" }]);
    const cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }, { text: "Buzz" }]);
    await cache.clear(llmString);
  });
  it("test AzureCosmosDBNoSqlSemanticCache with dotProduct flat", async () => {
    const cache = initializeCache("flat", "dotproduct");
    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());
    await cache.update("foo", llmString, [{ text: "fizz" }, { text: "Buzz" }]);
    const cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }, { text: "Buzz" }]);
    await cache.clear(llmString);
  });
  it("test AzureCosmosDBNoSqlSemanticCache with euclidean quantizedFlat", async () => {
    const cache = initializeCache("quantizedFlat", "euclidean");
    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());
    await cache.update("foo", llmString, [{ text: "fizz" }]);
    const cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);
    await cache.clear(llmString);
  });
  it("test AzureCosmosDBNoSqlSemanticCache with euclidean flat", async () => {
    const cache = initializeCache("flat", "euclidean");
    const llm = new FakeLLM({});
    const llmString = JSON.stringify(llm._identifyingParams());
    await cache.update("foo", llmString, [{ text: "fizz" }, { text: "Buzz" }]);
    const cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }, { text: "Buzz" }]);
    await cache.clear(llmString);
  });
});
