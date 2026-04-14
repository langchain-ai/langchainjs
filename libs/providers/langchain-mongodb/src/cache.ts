import { Collection, Document as MongoDBDocument } from "mongodb";
import {
  BaseCache,
  serializeGeneration,
  deserializeStoredGeneration,
} from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

export interface MongoDBCacheArgs {
  collection: Collection<MongoDBDocument>;
}

export class MongoDBCache extends BaseCache {
  private collection: Collection<MongoDBDocument>;

  private PROMPT = "prompt";

  private LLM = "llm";

  private RETURN_VAL = "return_val";

  constructor({ collection }: MongoDBCacheArgs) {
    super();
    this.collection = collection;
  }

  async lookup(prompt: string, llmKey: string): Promise<Generation[] | null> {
    const doc = await this.collection.findOne({
      [this.PROMPT]: { $eq: prompt },
      [this.LLM]: { $eq: llmKey },
    });
    if (!doc?.[this.RETURN_VAL]) return null;
    try {
      const arr = JSON.parse(doc[this.RETURN_VAL]);
      return arr.map((g: string) => deserializeStoredGeneration(JSON.parse(g)));
    } catch {
      return null;
    }
  }

  async update(
    prompt: string,
    llmKey: string,
    generations: Generation[]
  ): Promise<void> {
    const serialized = JSON.stringify(
      generations.map((g) => JSON.stringify(serializeGeneration(g)))
    );
    await this.collection.updateOne(
      { [this.PROMPT]: prompt, [this.LLM]: llmKey },
      { $set: { [this.RETURN_VAL]: serialized } },
      { upsert: true }
    );
  }

  async clear(filter: Record<string, unknown> = {}): Promise<void> {
    await this.collection.deleteMany(filter);
  }
}

export interface MongoDBAtlasSemanticCacheArgs {
  collection: Collection<MongoDBDocument>;
  embeddings: EmbeddingsInterface;
  indexName?: string;
  scoreThreshold?: number;
  waitUntilReady?: number;
}

export class MongoDBAtlasSemanticCache extends BaseCache {
  private collection: Collection<MongoDBDocument>;

  private embeddingModel: EmbeddingsInterface;

  private indexName: string;

  private scoreThreshold: number | null;

  private waitUntilReady: number | null;

  constructor(
    collection: Collection<MongoDBDocument>,
    embeddingModel: EmbeddingsInterface,
    options: {
      indexName?: string;
      scoreThreshold?: number | null;
      waitUntilReady?: number | null;
    } = {}
  ) {
    super();
    this.collection = collection;
    this.embeddingModel = embeddingModel;
    this.indexName = options.indexName ?? "default";
    this.scoreThreshold = options.scoreThreshold ?? null;
    this.waitUntilReady = options.waitUntilReady ?? null;
  }

  async lookup(
    prompt: string,
    llmString: string
  ): Promise<Generation[] | null> {
    const embedding = MongoDBAtlasSemanticCache.fixArrayPrecision(
      await this.getEmbedding(prompt)
    );
    const searchQuery = {
      queryVector: embedding,
      index: this.indexName,
      path: "embedding",
      limit: 1,
      numCandidates: 20,
    };
    const searchResponse = await this.collection
      .aggregate([
        { $vectorSearch: searchQuery },
        { $set: { score: { $meta: "vectorSearchScore" } } },
        {
          $match: {
            llm_string: MongoDBAtlasSemanticCache.extractModelName(
              llmString ?? ""
            ),
          },
        },
        { $limit: 1 },
      ])
      .toArray();
    if (
      searchResponse.length === 0 ||
      (this.scoreThreshold !== null &&
        searchResponse[0].score < this.scoreThreshold)
    ) {
      return null;
    }
    return searchResponse[0].return_val;
  }

  async update(
    prompt: string,
    llmString: string,
    returnVal: Generation[]
  ): Promise<void> {
    const embedding = await this.getEmbedding(prompt);
    await this.collection.insertOne({
      prompt,
      llm_string: MongoDBAtlasSemanticCache.extractModelName(llmString),
      return_val: returnVal,
      embedding,
    });
    if (this.waitUntilReady) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.waitUntilReady! * 1000);
      });
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    return await this.embeddingModel.embedQuery(text);
  }

  async clear(filters: Record<string, unknown> = {}): Promise<void> {
    await this.collection.deleteMany(filters);
  }

  static extractModelName(llmString: string): string {
    let safeLLMString = "unknown_model";
    const match = llmString.match(
      /(?:^|,)model_name:"([^"]+)"|(?:^|,)model:"([^"]+)"/
    );
    if (match) {
      safeLLMString = match[1] ?? match[2];
    }
    return safeLLMString;
  }

  static fixArrayPrecision(array: number[]): number[] {
    if (!Array.isArray(array)) {
      console.error("fixArrayPrecision received an invalid input:", array);
      return [];
    }
    return array.map((value) =>
      Number.isInteger(value) ? value + 0.000000000000001 : value
    );
  }
}
