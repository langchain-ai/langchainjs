import { VectorStore, VectorStoreRetriever } from "./base.js";
import { Document } from "../document.js";

export type SimilarityScoreFilters = {
  minSimilarityScore: number;
  dynamicK?: boolean;
  kIncrement?: number;
  maxK?: number;
};

export class SimilarityScoreThresholdVectorStoreRetriever {
  minSimilarityScore: number;

  dynamicK = false;

  kIncrement = 1;

  maxK = 100;

  constructor(similarityScoreFilters: SimilarityScoreFilters) {
    this.minSimilarityScore = similarityScoreFilters.minSimilarityScore;
    this.dynamicK = similarityScoreFilters.dynamicK ?? this.dynamicK;
    this.kIncrement = similarityScoreFilters.kIncrement ?? this.kIncrement;
    this.maxK = similarityScoreFilters.maxK ?? this.maxK;
  }

  private isAboveMinScore([, score]: [Document, number]): boolean {
    return score >= this.minSimilarityScore;
  }

  fromVectorStore(vectorStoreRetriever: VectorStoreRetriever<VectorStore>) {
    const isAboveMinScore = this.isAboveMinScore.bind(this);

    // eslint-disable-next-line no-param-reassign
    vectorStoreRetriever.getRelevantDocuments = async (query: string) => {
      if (!this.dynamicK) {
        const results =
          await vectorStoreRetriever.vectorStore.similaritySearchWithScore(
            query,
            vectorStoreRetriever.k,
            vectorStoreRetriever.filter
          );

        const filteredResults = results.filter(isAboveMinScore);

        return filteredResults.map(([document]) => document);
      }

      let updatedK = vectorStoreRetriever.k;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const results =
          await vectorStoreRetriever.vectorStore.similaritySearchWithScore(
            query,
            updatedK,
            vectorStoreRetriever.filter
          );

        const filteredResults = results.filter(isAboveMinScore);

        if (filteredResults.length < updatedK || updatedK === this.maxK) {
          return filteredResults.map(([document]) => document);
        }

        updatedK += this.kIncrement;
      }
    };

    return vectorStoreRetriever;
  }
}
