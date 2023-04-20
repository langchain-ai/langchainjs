import { VectorStore } from "vectorstores/base.js";
import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";

export interface TimeWeightedVectorStoreRetrieverFields {
  vectorStore: VectorStore;
  searchKwargs?: number;
  memoryStream?: Document[];
  decayRate?: number;
  k?: number;
  otherScoreKeys?: string[];
  defaultSalience?: number
}

export const LAST_ACCESSED_AT_KEY = "last_accessed_at";
export const BUFFER_IDX = "buffer_idx";
/**
 * https://github.com/hwchase17/langchain/blob/master/langchain/retrievers/time_weighted_retriever.py
*/
export class TimeWeightedVectorStoreRetriever extends BaseRetriever {

  private vectorStore: VectorStore;

  private searchKwargs: number;

  private memoryStream: Document[];

  private decayRate: number;

  private k: number;

  private otherScoreKeys: string[];

  private defaultSalience: number | null;


  constructor(fields: TimeWeightedVectorStoreRetrieverFields) {
    super();
    this.vectorStore = fields.vectorStore;
    this.searchKwargs = fields.searchKwargs ?? 100;
    this.memoryStream = fields.memoryStream ?? [];
    this.decayRate = fields.decayRate ?? 0.01;
    this.k = fields.k ?? 4;
    this.otherScoreKeys = fields.otherScoreKeys ?? [];
    this.defaultSalience = fields.defaultSalience ?? null;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const now = Math.floor(Date.now() / 1000);
    const memoryDocsAndScores: Record<number, { doc: Document, score: number }> = {};
    for (const doc of this.memoryStream.slice(-this.k)) {
      const bufferIdx = doc.metadata[BUFFER_IDX];
      memoryDocsAndScores[bufferIdx] = { doc, score: this.defaultSalience ?? 0 };
    }

    const salientDocsAndScores = await this.getSalientDocuments(query);
    const docsAndScores = { ...memoryDocsAndScores, ...salientDocsAndScores };

    const recordedDocs = Object.values(docsAndScores)
      .map(({ doc, score }) => ({ doc, score: this.getCombinedScore(doc, score, now) }))
      .sort((a, b) => b.score - a.score);

    const results: Document[] = [];
    for (const { doc } of recordedDocs) {
      const bufferedDoc = this.memoryStream[doc.metadata[BUFFER_IDX]];
      bufferedDoc.metadata[LAST_ACCESSED_AT_KEY] = now;
      results.push(bufferedDoc);
    }
    return results;
  }

  async addDocuments(docs: Document[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const savedDocs = docs.map((doc, i) => ({
      ...doc,
      metadata: {
        [LAST_ACCESSED_AT_KEY]: doc.metadata[LAST_ACCESSED_AT_KEY] ?? now,
        created_at: doc.metadata.created_at ?? now,
        [BUFFER_IDX]: this.memoryStream.length + i,
      }
    }));
    this.memoryStream.push(...savedDocs);
    await this.vectorStore.addDocuments(savedDocs);
  }

  private async getSalientDocuments(query: string): Promise<Record<number, { doc: Document, score: number }>> {
    const docAndScores: [Document, number][] = await this.vectorStore.similaritySearchWithScore(query, this.searchKwargs);
    const results: Record<number, { doc: Document, score: number }> = {};
    for (const [fetchedDoc, score] of docAndScores) {
      const bufferIdx = fetchedDoc.metadata[BUFFER_IDX];
      const doc = this.memoryStream[bufferIdx];
      results[bufferIdx] = { doc, score };
    }
    return results;
  }

  private getCombinedScore(doc: Document, vectorRelevance: number | null, nowMsec: number): number {
    const hoursPassed = this.getHoursPassed(nowMsec, doc.metadata[LAST_ACCESSED_AT_KEY]);
    let score = (1.0 - this.decayRate) ** hoursPassed;
    for (const key of this.otherScoreKeys) {
      score += doc.metadata[key];
    }
    if (vectorRelevance !== null) {
      score += vectorRelevance;
    }
    return score;
  }


  private getHoursPassed(time: number, refTime: number): number {
    return (time - refTime) / 3600;
  }
}
