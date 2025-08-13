import { BaseRetriever } from "@langchain/core/retrievers";
import { VectorStoreInterface } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

export interface RecencyRankedRetrieverConfig {
  vectorStore: VectorStoreInterface;
  k: number;
  topK?: number;
  recencyWeight: number;
}

export class RecencyRankedRetriever extends BaseRetriever {
  static lc_name() {
    return "RecencyRankedRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "recency_ranked"];
  
  private vectorStore: VectorStoreInterface;

  private k: number;

  private topK: number;

  private recencyWeight: number;

  constructor(config: RecencyRankedRetrieverConfig) {
    super();
    this.vectorStore = config.vectorStore;
    this.k = config.k;
    this.topK = config.topK ?? config.k;
    this.recencyWeight = config.recencyWeight;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const relevantDocs = await this.vectorStore.similaritySearchWithScore(query, this.k);
    const rerankedDocs = this.recentDocumentRanker(relevantDocs, this.topK, this.recencyWeight);
    return rerankedDocs.map(([doc, _]) => doc);
  }

  async invoke(query: string): Promise<Document[]> {
    return this._getRelevantDocuments(query);
  }

  private recentDocumentRanker(
    documents: [Document, number][],
    topK: number,
    recencyWeight: number
  ): [Document, number][] {
    if (documents.length === 0) return [];

    if (!documents.every(([doc, _]) => doc.metadata.date instanceof Date)) {
        throw new Error("All documents must have a 'date' metadata of type Date");
    }

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
