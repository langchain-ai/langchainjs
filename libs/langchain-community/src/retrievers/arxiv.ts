import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import {
  searchArxiv,
  loadDocsFromResults,
  getDocsFromSummaries,
} from "../utils/arxiv.js";

export type ArxivRetrieverOptions = {
  returnFullDocuments?: boolean;
  maxSearchResults?: number;
} & BaseRetrieverInput;

/**
 * A retriever that searches arXiv for relevant articles based on a query.
 * It can retrieve either full documents (PDFs) or just summaries.
 */
export class ArxivRetriever extends BaseRetriever {
  static lc_name() {
    return "ArxivRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "arxiv_retriever"];

  returnFullDocuments = false;

  maxSearchResults = 10;

  constructor(options: ArxivRetrieverOptions = {}) {
    super(options);
    this.returnFullDocuments =
      options.returnFullDocuments ?? this.returnFullDocuments;
    this.maxSearchResults = options.maxSearchResults ?? this.maxSearchResults;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    try {
      const results = await searchArxiv(query, this.maxSearchResults);

      if (this.returnFullDocuments) {
        // Fetch and parse PDFs to get full documents
        return await loadDocsFromResults(results);
      } else {
        // Use summaries as documents
        return getDocsFromSummaries(results);
      }
    } catch (error) {
      throw new Error(`Error retrieving documents from arXiv.`);
    }
  }
}
