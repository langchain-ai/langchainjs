import {
  BaseCache,
  deserializeStoredGeneration,
  getCacheKey,
  serializeGeneration,
} from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";
import { Document } from "@langchain/core/documents";
import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { CosmosClient, CosmosClientOptions } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  AzureCosmosDBNoSQLConfig,
  AzureCosmosDBNoSQLVectorStore,
} from "./azure_cosmosdb_nosql.js";

const USER_AGENT_SUFFIX = "langchainjs-cdbnosql-semanticcache-javascript";
const DEFAULT_CONTAINER_NAME = "semanticCacheContainer";

/**
 * Represents a Semantic Cache that uses CosmosDB NoSQL backend as the underlying
 * storage system.
 *
 * @example
 * ```typescript
 * const embeddings = new OpenAIEmbeddings();
 * const cache = new AzureCosmosDBNoSQLSemanticCache(embeddings, {
 *   databaseName: DATABASE_NAME,
 *   containerName: CONTAINER_NAME
 * });
 * const model = new ChatOpenAI({cache});
 *
 * // Invoke the model to perform an action
 * const response = await model.invoke("Do something random!");
 * console.log(response);
 * ```
 */
export class AzureCosmosDBNoSQLSemanticCache extends BaseCache {
  private embeddings: EmbeddingsInterface;

  private config: AzureCosmosDBNoSQLConfig;

  private similarityScoreThreshold: number;

  private cacheDict: { [key: string]: AzureCosmosDBNoSQLVectorStore } = {};

  private vectorDistanceFunction: string;

  constructor(
    embeddings: EmbeddingsInterface,
    dbConfig: AzureCosmosDBNoSQLConfig,
    similarityScoreThreshold: number = 0.6
  ) {
    super();
    let client: CosmosClient;

    const connectionString =
      dbConfig.connectionString ??
      getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_CONNECTION_STRING");

    const endpoint =
      dbConfig.endpoint ??
      getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_ENDPOINT");

    if (!dbConfig.client && !connectionString && !endpoint) {
      throw new Error(
        "AzureCosmosDBNoSQLSemanticCache client, connection string or endpoint must be set."
      );
    }

    if (!dbConfig.client) {
      if (connectionString) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let [endpoint, key] = connectionString!.split(";");
        [, endpoint] = endpoint.split("=");
        [, key] = key.split("=");

        client = new CosmosClient({
          endpoint,
          key,
          userAgentSuffix: USER_AGENT_SUFFIX,
        });
      } else {
        // Use managed identity
        client = new CosmosClient({
          endpoint,
          aadCredentials: dbConfig.credentials ?? new DefaultAzureCredential(),
          userAgentSuffix: USER_AGENT_SUFFIX,
        } as CosmosClientOptions);
      }
    } else {
      client = dbConfig.client;
    }

    this.vectorDistanceFunction =
      dbConfig.vectorEmbeddingPolicy?.vectorEmbeddings[0].distanceFunction ??
      "cosine";

    this.config = {
      ...dbConfig,
      client,
      databaseName: dbConfig.databaseName,
      containerName: dbConfig.containerName ?? DEFAULT_CONTAINER_NAME,
    };
    this.embeddings = embeddings;
    this.similarityScoreThreshold = similarityScoreThreshold;
  }

  private getLlmCache(llmKey: string) {
    const key = getCacheKey(llmKey);
    if (!this.cacheDict[key]) {
      this.cacheDict[key] = new AzureCosmosDBNoSQLVectorStore(
        this.embeddings,
        this.config
      );
    }
    return this.cacheDict[key];
  }

  /**
   * Retrieves data from the cache.
   *
   * @param prompt The prompt for lookup.
   * @param llmKey The LLM key used to construct the cache key.
   * @returns An array of Generations if found, null otherwise.
   */
  public async lookup(prompt: string, llmKey: string) {
    const llmCache = this.getLlmCache(llmKey);

    const results = await llmCache.similaritySearchWithScore(prompt, 1);
    if (!results.length) return null;

    const generations = results
      .flatMap(([document, score]) => {
        const isSimilar =
          (this.vectorDistanceFunction === "euclidean" &&
            score <= this.similarityScoreThreshold) ||
          (this.vectorDistanceFunction !== "euclidean" &&
            score >= this.similarityScoreThreshold);

        if (!isSimilar) return undefined;

        return document.metadata.return_value.map((gen: string) =>
          deserializeStoredGeneration(JSON.parse(gen))
        );
      })
      .filter((gen) => gen !== undefined);

    return generations.length > 0 ? generations : null;
  }

  /**
   * Updates the cache with new data.
   *
   * @param prompt The prompt for update.
   * @param llmKey The LLM key used to construct the cache key.
   * @param value The value to be stored in the cache.
   */
  public async update(
    prompt: string,
    llmKey: string,
    returnValue: Generation[]
  ) {
    const serializedGenerations = returnValue.map((generation) =>
      JSON.stringify(serializeGeneration(generation))
    );
    const llmCache = this.getLlmCache(llmKey);
    const metadata = {
      llm_string: llmKey,
      prompt,
      return_value: serializedGenerations,
    };
    const doc = new Document({
      pageContent: prompt,
      metadata,
    });
    await llmCache.addDocuments([doc]);
  }

  /**
   * deletes the semantic cache for a given llmKey
   * @param llmKey
   */
  public async clear(llmKey: string) {
    const key = getCacheKey(llmKey);
    if (this.cacheDict[key]) {
      await this.cacheDict[key].delete();
    }
  }
}
