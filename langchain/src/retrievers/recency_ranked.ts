import { BaseRetriever } from "@langchain/core/retrievers";
import { VectorStoreInterface } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

export interface RecencyRankedRetrieverConfig {
  vectorStore: VectorStoreInterface;
  k: number;
  top_k?: number;
  recencyWeight: number;
}

export class RecencyRankedRetriever extends BaseRetriever {
  static lc_name() {
    return "RecencyRankedRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "recency_ranked"];
  
  private vectorStore: VectorStoreInterface;

  private k: number;

  private top_k: number;

  private recencyWeight: number;

  constructor(config: RecencyRankedRetrieverConfig) {
    super();
    this.vectorStore = config.vectorStore;
    this.k = config.k;
    this.top_k = config.top_k ?? config.k;
    this.recencyWeight = config.recencyWeight;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const relevantDocs = await this.vectorStore.similaritySearchWithScore(query, this.k);
    const rerankedDocs = this.recentDocumentRanker(relevantDocs, this.top_k, this.recencyWeight);
    return rerankedDocs.map(([doc, _]) => doc);
  }

  private recentDocumentRanker(
    documents: [Document, number][],
    topK: number,
    recencyWeight: number
  ): [Document, number][] {
    if (documents.length === 0) return [];

    const oldestDate = Math.min(
      ...documents.map(([doc, _]) => doc.metadata.date.getTime())
    );
    const newestDate = Math.max(
      ...documents.map(([doc, _]) => doc.metadata.date.getTime())
    );
    const dateRange = newestDate - oldestDate;

    const rerankedDocuments = documents
      .map(([doc, score]): [Document, number] => {
        const normalizedRecency =
          dateRange > 0
            ? (doc.metadata.date.getTime() - oldestDate) / dateRange
            : 1;
        const adjustedScore =
          (1 - recencyWeight) * score + recencyWeight * normalizedRecency;
        return [doc, adjustedScore];
      })
      .sort((a, b) => b[1] - a[1]);

    return rerankedDocuments.slice(0, topK);
  }
}