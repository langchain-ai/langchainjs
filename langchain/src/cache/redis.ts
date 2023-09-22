import { createCluster, createClient } from "redis";

import crypto from "crypto";
import { BaseCache, Generation, GenerationChunk } from "../schema/index.js";
import { getCacheKey } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { RedisVectorStore } from "../vectorstores/redis.js";
import { Document } from "../document.js";
import { ScoreThresholdRetriever } from "../retrievers/score_threshold.js";

/**
 * Represents the type of the Redis client used to interact with the Redis
 * database.
 */
type RedisClientType =
  | ReturnType<typeof createClient>
  | ReturnType<typeof createCluster>;

/**
 * Represents a specific implementation of a caching mechanism using Redis
 * as the underlying storage system. It extends the `BaseCache` class and
 * overrides its methods to provide the Redis-specific logic.
 */
export class RedisCache extends BaseCache {
  private redisClient: RedisClientType;

  constructor(redisClient: RedisClientType) {
    super();
    this.redisClient = redisClient;
  }

  /**
   * Retrieves data from the cache. It constructs a cache key from the given
   * `prompt` and `llmKey`, and retrieves the corresponding value from the
   * Redis database.
   * @param prompt The prompt used to construct the cache key.
   * @param llmKey The LLM key used to construct the cache key.
   * @returns An array of Generations if found, null otherwise.
   */
  public async lookup(prompt: string, llmKey: string) {
    let idx = 0;
    let key = getCacheKey(prompt, llmKey, String(idx));
    let value = await this.redisClient.get(key);
    const generations: Generation[] = [];

    while (value) {
      if (!value) {
        break;
      }

      generations.push({ text: value });
      idx += 1;
      key = getCacheKey(prompt, llmKey, String(idx));
      value = await this.redisClient.get(key);
    }

    return generations.length > 0 ? generations : null;
  }

  /**
   * Updates the cache with new data. It constructs a cache key from the
   * given `prompt` and `llmKey`, and stores the `value` in the Redis
   * database.
   * @param prompt The prompt used to construct the cache key.
   * @param llmKey The LLM key used to construct the cache key.
   * @param value The value to be stored in the cache.
   */
  public async update(prompt: string, llmKey: string, value: Generation[]) {
    for (let i = 0; i < value.length; i += 1) {
      const key = getCacheKey(prompt, llmKey, String(i));
      await this.redisClient.set(key, value[i].text);
    }
  }
}

interface CacheDict {
  [index: string]: RedisVectorStore;
}

function hash(input: string) {
  return crypto.createHash("md5").update(input, "utf8").digest("hex");
}

/**
 * Load generations from json.
 *
 * @param {string} generationsJson - A string of json representing a list of generations.
 * @throws {Error} Could not decode json string to list of generations.
 * @returns {Generation[]} A list of generations.
 */
function loadGenerationsFromJson(generationsJson: string): GenerationChunk[] {
  try {
    const results = JSON.parse(generationsJson);
    return results.map(
      (generationDict: {
        text: string;
        generationInfo?: Record<string, any>;
      }) => {
        if (typeof generationDict.text !== "string") {
          throw new Error(`Invalid generation text: ${generationDict.text}`);
        }
        return new GenerationChunk(generationDict);
      }
    );
  } catch (error) {
    throw new Error(
      `Could not decode json to list of generations: ${generationsJson}`
    );
  }
}

function dumpGenerationsToJson(generations: Generation[]): string {
  return JSON.stringify(
    generations.map((generation) => ({ text: generation.text }))
  );
}

export class RedisSemanticCache extends BaseCache {
  private cacheDict: CacheDict;

  private redisUrl: string;

  private embedding: Embeddings;

  private scoreThreshold: number;

  constructor(redisUrl: string, embedding: Embeddings, scoreThreshold = 0.2) {
    super();
    this.cacheDict = {};
    this.redisUrl = redisUrl;
    this.embedding = embedding;
    this.scoreThreshold = scoreThreshold;
  }

  private indexName(llmKey: string): string {
    const hashedIndex = hash(llmKey);
    return `cache:${hashedIndex}`;
  }

  // private async getLlmCache(llmKey: string): Promise<RedisVectorStore> {
  //   const indexName = this.indexName(llmKey);

  //   if (indexName in this.cacheDict) {
  //     return this.cacheDict[indexName];
  //   }

  //   const client = createClient({ url: this.redisUrl });
  //   await client.connect();

  //   try {
  //     this.cacheDict[indexName] = await RedisVectorStore.fromExistingIndex(
  //       this.embedding,
  //       {
  //         indexName,
  //         redisClient: client,
  //       }
  //     );
  //   } catch (error) {
  //     const redis = new RedisVectorStore(this.embedding, {
  //       indexName,
  //       redisClient: client,
  //     });
  //     const embedding = await this.embedding.embedQuery("test");
  //     await redis.createIndex(embedding.length);
  //     this.cacheDict[indexName] = redis;
  //   }

  //   return this.cacheDict[indexName];
  // }

  private async getLlmCache(
    llmKey: string
  ): Promise<ScoreThresholdRetriever<RedisVectorStore>> {
    const indexName = this.indexName(llmKey);

    const scoreThresholdOptions = {
      minSimilarityScore: this.scoreThreshold,
      maxK: 1,
    };

    if (indexName in this.cacheDict) {
      return ScoreThresholdRetriever.fromVectorStore(
        this.cacheDict[indexName],
        scoreThresholdOptions
      );
    }

    const client = createClient({ url: this.redisUrl });
    await client.connect();

    try {
      this.cacheDict[indexName] = await RedisVectorStore.fromExistingIndex(
        this.embedding,
        {
          indexName,
          redisClient: client,
        }
      );
    } catch (error) {
      const redis = new RedisVectorStore(this.embedding, {
        indexName,
        redisClient: client,
      });
      const embedding = await this.embedding.embedQuery("test");
      await redis.createIndex(embedding.length);
      this.cacheDict[indexName] = redis;
    }

    return ScoreThresholdRetriever.fromVectorStore(
      this.cacheDict[indexName],
      scoreThresholdOptions
    );
  }

  async clear(llmKey: string): Promise<void> {
    const indexName = this.indexName(llmKey);

    if (indexName in this.cacheDict) {
      await this.cacheDict[indexName].dropIndex(true);
      delete this.cacheDict[indexName];
    }
  }

  async lookup(prompt: string, llmKey: string): Promise<Generation[] | null> {
    const llmCache = await this.getLlmCache(llmKey);
    // const results = await llmCache.similaritySearch(prompt, 1);
    const results = await llmCache.getRelevantDocuments(prompt);

    let generations: Generation[] = [];
    if (results) {
      for (const document of results) {
        generations = generations.concat(
          loadGenerationsFromJson(document.metadata.return_val)
        );
      }
    }

    return generations.length > 0 ? generations : null;
  }

  async update(
    prompt: string,
    llmKey: string,
    returnVal: Generation[]
  ): Promise<void> {
    const llmCache = await this.getLlmCache(llmKey);

    const metadata = {
      llm_string: llmKey,
      prompt,
      return_val: dumpGenerationsToJson(returnVal),
    };
    const document = new Document({
      pageContent: prompt,
      metadata,
    });

    await llmCache.addDocuments([document]);
  }
}
