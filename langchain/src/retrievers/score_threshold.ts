import {
  VectorStore,
  VectorStoreRetriever,
  VectorStoreRetrieverInput,
} from "../vectorstores/base.js";
import { Document } from "../document.js";

export type ScoreThresholdRetrieverInput<V extends VectorStore> = Omit<
  VectorStoreRetrieverInput<V>,
  "k"
> & {
  maxK?: number;
  kIncrement?: number;
  minSimilarityScore: number;
};

export class ScoreThresholdRetriever<
  V extends VectorStore
> extends VectorStoreRetriever<V> {
  minSimilarityScore: number;

  kIncrement = 10;

  maxK = 100;

  constructor(input: ScoreThresholdRetrieverInput<V>) {
    super(input);
    this.maxK = input.maxK ?? this.maxK;
    this.minSimilarityScore =
      input.minSimilarityScore ?? this.minSimilarityScore;
    this.kIncrement = input.kIncrement ?? this.kIncrement;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    let currentK = 0;
    let filteredResults: [Document, number][] = [];
    do {
      currentK += this.kIncrement;
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        currentK,
        this.filter
      );
      filteredResults = results.filter(
        ([, score]) => score >= this.minSimilarityScore
      );
    } while (filteredResults.length >= currentK && currentK < this.maxK);
    return filteredResults.map((documents) => documents[0]).slice(0, this.maxK);
  }

  static fromVectorStore<V extends VectorStore>(
    vectorStore: V,
    options: Omit<ScoreThresholdRetrieverInput<V>, "vectorStore">
  ) {
    return new this<V>({ ...options, vectorStore });
  }
}
