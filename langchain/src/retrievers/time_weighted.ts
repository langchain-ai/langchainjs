import { VectorStore } from "../vectorstores/base.js";
import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";

export interface TimeWeightedVectorStoreRetrieverFields {
  vectorStore: VectorStore;
  searchKwargs?: number;
  memoryStream?: Document[];
  decayRate?: number;
  k?: number;
  otherScoreKeys?: string[];
  defaultSalience?: number;
}

export const LAST_ACCESSED_AT_KEY = "last_accessed_at";
export const BUFFER_IDX = "buffer_idx";

/**
 * TimeWeightedVectorStoreRetriever retrieves documents based on their time-weighted relevance.
 * ref: https://github.com/hwchase17/langchain/blob/master/langchain/retrievers/time_weighted_retriever.py
 */
export class TimeWeightedVectorStoreRetriever extends BaseRetriever {
  /**
   * The vectorstore to store documents and determine salience.
   */
  private vectorStore: VectorStore;

  /**
   * The number of top K most relevant documents to consider when searching.
   */
  private searchKwargs: number;

  /**
   * The memory_stream of documents to search through.
   */
  private memoryStream: Document[];

  /**
   * The exponential decay factor used as (1.0-decay_rate)**(hrs_passed).
   */
  private decayRate: number;

  /**
   * The maximum number of documents to retrieve in a given call.
   */
  private k: number;

  /**
   * Other keys in the metadata to factor into the score, e.g. 'importance'.
   */
  private otherScoreKeys: string[];

  /**
   * The salience to assign memories not retrieved from the vector store.
   */
  private defaultSalience: number | null;

  /**
   * Constructor to initialize the required fields
   * @param fields - The fields required for initializing the TimeWeightedVectorStoreRetriever
   */
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

  /**
   * Get relevant documents based on time-weighted relevance
   * @param query - The query to search for
   * @returns The relevant documents
   */
  async getRelevantDocuments(query: string): Promise<Document[]> {
    const now = Math.floor(Date.now() / 1000);
    const memoryDocsAndScores = this.getMemoryDocsAndScores();

    const salientDocsAndScores = await this.getSalientDocuments(query);
    const docsAndScores = { ...memoryDocsAndScores, ...salientDocsAndScores };

    return this.computeResults(docsAndScores, now);
  }

  /**
   * NOTE: When adding documents to a vector store, use addDocuments
   * via retriever instead of directly to the vector store.
   * This is because it is necessary to process the document
   * in prepareDocuments.
   *
   * @param docs - The documents to add to vector store in the retriever
   */
  async addDocuments(docs: Document[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const savedDocs = this.prepareDocuments(docs, now);

    this.memoryStream.push(...savedDocs);
    await this.vectorStore.addDocuments(savedDocs);
  }

  /**
   * Get memory documents and their scores
   * @returns An object containing memory documents and their scores
   */
  private getMemoryDocsAndScores(): Record<
    number,
    { doc: Document; score: number }
  > {
    const memoryDocsAndScores: Record<
      number,
      { doc: Document; score: number }
    > = {};
    for (const doc of this.memoryStream.slice(-this.k)) {
      const bufferIdx = doc.metadata[BUFFER_IDX];
      if (bufferIdx === undefined) {
        throw new Error(
          `Found a document in the vector store that is missing required metadata. This retriever only supports vector stores with documents that have been added through the "addDocuments" method on a TimeWeightedVectorStoreRetriever, not directly added or loaded into the backing vector store.`
        );
      }
      memoryDocsAndScores[bufferIdx] = {
        doc,
        score: this.defaultSalience ?? 0,
      };
    }
    return memoryDocsAndScores;
  }

  /**
   * Get salient documents and their scores based on the query
   * @param query - The query to search for
   * @returns An object containing salient documents and their scores
   */
  private async getSalientDocuments(
    query: string
  ): Promise<Record<number, { doc: Document; score: number }>> {
    const docAndScores: [Document, number][] =
      await this.vectorStore.similaritySearchWithScore(
        query,
        this.searchKwargs
      );
    const results: Record<number, { doc: Document; score: number }> = {};
    for (const [fetchedDoc, score] of docAndScores) {
      const bufferIdx = fetchedDoc.metadata[BUFFER_IDX];
      if (bufferIdx === undefined) {
        throw new Error(
          `Found a document in the vector store that is missing required metadata. This retriever only supports vector stores with documents that have been added through the "addDocuments" method on a TimeWeightedVectorStoreRetriever, not directly added or loaded into the backing vector store.`
        );
      }
      const doc = this.memoryStream[bufferIdx];
      results[bufferIdx] = { doc, score };
    }
    return results;
  }

  /**
   * Compute the final result set of documents based on the combined scores
   * @param docsAndScores - An object containing documents and their scores
   * @param now - The current timestamp
   * @returns The final set of documents
   */
  private computeResults(
    docsAndScores: Record<number, { doc: Document; score: number }>,
    now: number
  ): Document[] {
    const recordedDocs = Object.values(docsAndScores)
      .map(({ doc, score }) => ({
        doc,
        score: this.getCombinedScore(doc, score, now),
      }))
      .sort((a, b) => b.score - a.score);

    const results: Document[] = [];
    for (const { doc } of recordedDocs) {
      const bufferedDoc = this.memoryStream[doc.metadata[BUFFER_IDX]];
      bufferedDoc.metadata[LAST_ACCESSED_AT_KEY] = now;
      results.push(bufferedDoc);
    }
    return results;
  }

  /**
   * Prepare documents with necessary metadata before saving
   * @param docs - The documents to prepare
   * @param now - The current timestamp
   * @returns The prepared documents
   */
  private prepareDocuments(docs: Document[], now: number): Document[] {
    return docs.map((doc, i) => ({
      ...doc,
      metadata: {
        [LAST_ACCESSED_AT_KEY]: doc.metadata[LAST_ACCESSED_AT_KEY] ?? now,
        created_at: doc.metadata.created_at ?? now,
        [BUFFER_IDX]: this.memoryStream.length + i,
      },
    }));
  }

  /**
   * Calculate the combined score based on vector relevance and other factors
   * @param doc - The document to calculate the score for
   * @param vectorRelevance - The relevance score
   * from the vector store
@param nowMsec - The current timestamp in milliseconds
@returns The combined score for the document
*/
  private getCombinedScore(
    doc: Document,
    vectorRelevance: number | null,
    nowMsec: number
  ): number {
    const hoursPassed = this.getHoursPassed(
      nowMsec,
      doc.metadata[LAST_ACCESSED_AT_KEY]
    );
    let score = (1.0 - this.decayRate) ** hoursPassed;
    for (const key of this.otherScoreKeys) {
      score += doc.metadata[key];
    }
    if (vectorRelevance !== null) {
      score += vectorRelevance;
    }
    return score;
  }

  /**

  Calculate the hours passed between two time points
  @param time - The current time in seconds
  @param refTime - The reference time in seconds
  @returns The number of hours passed between the two time points
  */
  private getHoursPassed(time: number, refTime: number): number {
    return (time - refTime) / 3600;
  }
}
