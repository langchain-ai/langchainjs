import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

import { BM25 } from "../utils/@furkantoprak/bm25/BM25.js";

export type BM25RetrieverOptions = {
  docs: Document[];
  k: number;
  includeScore?: boolean;
} & BaseRetrieverInput;

/**
 * A retriever that uses the BM25 algorithm to rank documents based on their
 * similarity to a query. It uses the "okapibm25" package for BM25 scoring.
 * The k parameter determines the number of documents to return for each query.
 */
export class BM25Retriever extends BaseRetriever {
  includeScore = false;

  static lc_name() {
    return "BM25Retriever";
  }

  lc_namespace = ["langchain", "retrievers", "bm25_retriever"];

  static fromDocuments(
    documents: Document[],
    options: Omit<BM25RetrieverOptions, "docs">
  ) {
    return new this({ ...options, docs: documents });
  }

  docs: Document[];

  k: number;

  constructor(options: BM25RetrieverOptions) {
    super(options);
    this.docs = options.docs;
    this.k = options.k;
    this.includeScore = options.includeScore ?? this.includeScore;
  }

  private preprocessFunc(text: string): string[] {
    return text.toLowerCase().split(/\s+/);
  }

  async _getRelevantDocuments(query: string) {
    const processedQuery = this.preprocessFunc(query);
    const scoredDocs = BM25<Document>(
      this.docs.map((d) => ({
        text: d.pageContent,
        docs: d,
      })),
      processedQuery,
      undefined,
      (a, b) => b.score - a.score
    );

    return scoredDocs.slice(0, this.k).map((item) => {
      if (this.includeScore) {
        return new Document({
          ...(item.docs.id && { id: item.docs.id }),
          pageContent: item.docs.pageContent,
          metadata: {
            bm25Score: item.score,
            ...item.docs.metadata,
          },
        });
      } else {
        return item.docs;
      }
    });
  }
}
