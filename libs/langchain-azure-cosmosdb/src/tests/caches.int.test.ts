/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  CosmosClient,
  IndexingMode,
  VectorEmbeddingPolicy,
} from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
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
  distanceFunction: "euclidean" | "cosine" | "dotproduct",
  dimension: number
): VectorEmbeddingPolicy {
  return {
    vectorEmbeddings: [
      {
        path: "/embedding",
        dataType: "float32",
        distanceFunction,
        dimensions: dimension,
      },
    ],
  };
}

async function initializeCache(
  indexType: any,
  distanceFunction: any,
  similarityThreshold?: number
): Promise<AzureCosmosDBNoSQLSemanticCache> {
  let cache: AzureCosmosDBNoSQLSemanticCache;
  const embeddingModel = new OpenAIEmbeddings();
  const testEmbedding = await embeddingModel.embedDocuments(["sample text"]);
  const dimension = Math.min(
    testEmbedding[0].length,
    indexType === "flat" ? 505 : 4096
  );
  if (process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING) {
    cache = new AzureCosmosDBNoSQLSemanticCache(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
        connectionString: process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING,
        indexingPolicy: indexingPolicy(indexType),
        vectorEmbeddingPolicy: vectorEmbeddingPolicy(
          distanceFunction,
          dimension
        ),
      },
      similarityThreshold
    );
  } else if (process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT) {
    cache = new AzureCosmosDBNoSQLSemanticCache(
      new OpenAIEmbeddings(),
      {
        databaseName: DATABASE_NAME,
        containerName: CONTAINER_NAME,
        endpoint: process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT,
        indexingPolicy: indexingPolicy(indexType),
        vectorEmbeddingPolicy: vectorEmbeddingPolicy(
          distanceFunction,
          dimension
        ),
      },
      similarityThreshold
    );
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
 * - AZURE_OPENAI_API_KEY
 * - AZURE_OPENAI_API_INSTANCE_NAME
 * - AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
 * - AZURE_OPENAI_API_VERSION
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
    const cache = await initializeCache("quantizedFlat", "cosine");
    const model = new ChatOpenAI({ cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("test AzureCosmosDBNoSqlSemanticCache with cosine flat", async () => {
    const cache = await initializeCache("flat", "cosine");
    const model = new ChatOpenAI({ cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("test AzureCosmosDBNoSqlSemanticCache with dotProduct quantizedFlat", async () => {
    const cache = await initializeCache("quantizedFlat", "dotproduct");
    const model = new ChatOpenAI({ cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("test AzureCosmosDBNoSqlSemanticCache with dotProduct flat", async () => {
    const cache = await initializeCache("flat", "cosine");
    const model = new ChatOpenAI({ cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("test AzureCosmosDBNoSqlSemanticCache with euclidean quantizedFlat", async () => {
    const cache = await initializeCache("quantizedFlat", "euclidean");
    const model = new ChatOpenAI({ cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("test AzureCosmosDBNoSqlSemanticCache with euclidean flat", async () => {
    const cache = await initializeCache("flat", "euclidean");
    const model = new ChatOpenAI({ cache });
    const llmString = JSON.stringify(model._identifyingParams);
    await cache.update("foo", llmString, [{ text: "fizz" }]);

    let cacheOutput = await cache.lookup("foo", llmString);
    expect(cacheOutput).toEqual([{ text: "fizz" }]);

    cacheOutput = await cache.lookup("bar", llmString);
    expect(cacheOutput).toEqual(null);

    await cache.clear(llmString);
  });

  it("test AzureCosmosDBNoSqlSemanticCache response according to similarity score", async () => {
    const cache = await initializeCache("quantizedFlat", "cosine");
    const model = new ChatOpenAI({ cache });
    const response1 = await model.invoke(
      "Where is the headquarter of Microsoft?"
    );
    console.log(response1.content);
    // gives similarity score of 0.56 which is less than the threshold of 0.6. The cache
    // will retun null which will allow the model to generate result.
    const response2 = await model.invoke(
      "List all Microsoft offices in India."
    );
    expect(response2.content).not.toEqual(response1.content);
    console.log(response2.content);
    // gives similarity score of .63 > 0.6
    const response3 = await model.invoke("Tell me something about Microsoft");
    expect(response3.content).toEqual(response1.content);
    console.log(response3.content);
  });
});
