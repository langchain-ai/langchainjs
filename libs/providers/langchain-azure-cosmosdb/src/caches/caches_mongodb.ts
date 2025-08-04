import {
  BaseCache,
  deserializeStoredGeneration,
  getCacheKey,
  serializeGeneration,
} from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";
import { Document } from "@langchain/core/documents";
import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { MongoClient } from "mongodb";
import {
  AzureCosmosDBMongoDBConfig,
  AzureCosmosDBMongoDBVectorStore,
  AzureCosmosDBMongoDBSimilarityType,
} from "../azure_cosmosdb_mongodb.js";

/**
 * Represents a Semantic Cache that uses CosmosDB MongoDB backend as the underlying
 * storage system.
 *
 * @example
 * ```typescript
 * const embeddings = new OpenAIEmbeddings();
 * const cache = new AzureCosmosDBMongoDBSemanticCache(embeddings, {
 *   client?: MongoClient
 * });
 * const model = new ChatOpenAI({ model: "gpt-4o-mini", cache });
 *
 * // Invoke the model to perform an action
 * const response = await model.invoke("Do something random!");
 * console.log(response);
 * ```
 */
export class AzureCosmosDBMongoDBSemanticCache extends BaseCache {
  private embeddings: EmbeddingsInterface;

  private config: AzureCosmosDBMongoDBConfig;

  private similarityScoreThreshold: number;

  private cacheDict: { [key: string]: AzureCosmosDBMongoDBVectorStore } = {};

  private readonly client: MongoClient | undefined;

  private vectorDistanceFunction: string;

  constructor(
    embeddings: EmbeddingsInterface,
    dbConfig: AzureCosmosDBMongoDBConfig,
    similarityScoreThreshold: number = 0.6
  ) {
    super();

    const connectionString =
      dbConfig.connectionString ??
      getEnvironmentVariable("AZURE_COSMOSDB_MONGODB_CONNECTION_STRING");

    if (!dbConfig.client && !connectionString) {
      throw new Error(
        "AzureCosmosDBMongoDBSemanticCache client or connection string must be set."
      );
    }

    if (!dbConfig.client) {
      this.client = new MongoClient(connectionString!, {
        appName: "langchainjs",
      });
    } else {
      this.client = dbConfig.client;
    }

    this.config = {
      ...dbConfig,
      client: this.client,
      collectionName: dbConfig.collectionName ?? "semanticCacheContainer",
    };

    this.similarityScoreThreshold = similarityScoreThreshold;
    this.embeddings = embeddings;
    this.vectorDistanceFunction =
      dbConfig?.indexOptions?.similarity ??
      AzureCosmosDBMongoDBSimilarityType.COS;
  }

  private getLlmCache(llmKey: string) {
    const key = getCacheKey(llmKey);
    if (!this.cacheDict[key]) {
      this.cacheDict[key] = new AzureCosmosDBMongoDBVectorStore(
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
  async lookup(prompt: string, llmKey: string): Promise<Generation[] | null> {
    const llmCache = this.getLlmCache(llmKey);

    const queryEmbedding = await this.embeddings.embedQuery(prompt);
    const results = await llmCache.similaritySearchVectorWithScore(
      queryEmbedding,
      1,
      this.config.indexOptions?.indexType
    );
    if (!results.length) return null;

    const generations = results
      .flatMap(([document, score]) => {
        const isSimilar =
          (this.vectorDistanceFunction ===
            AzureCosmosDBMongoDBSimilarityType.L2 &&
            score <= this.similarityScoreThreshold) ||
          (this.vectorDistanceFunction !==
            AzureCosmosDBMongoDBSimilarityType.L2 &&
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
  ): Promise<void> {
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
