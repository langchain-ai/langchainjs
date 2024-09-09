import BM25 from "okapibm25";
import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

export type BM25RetrieverOptions = {
  docs: Document[];
  k: number;
  preprocessFunc: (text: string) => string[];
};

/**
 * A retriever that uses the BM25 algorithm to rank documents based on their
 * similarity to a query. It uses the okapibm25 package for BM25 scoring.
 * The k parameter determines the number of documents to return for each query.
 */
export class BM25Retriever extends BaseRetriever {
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
  
  preprocessFunc: (text: string) => string[];

  constructor(options: BM25RetrieverOptions) {
    super();
    this.docs = options.docs;
    this.k = options.k;
    this.preprocessFunc = options.preprocessFunc;
  }

  async _getRelevantDocuments(query: string) {
    const processedQuery = this.preprocessFunc(query);
    const documents = this.docs.map(doc => doc.pageContent);
    const scores = BM25.default(documents, processedQuery) as number[];
    
    const scoredDocs = this.docs.map((doc, index) => ({
      document: doc,
      score: scores[index],
    }));
    
    scoredDocs.sort((a, b) => b.score - a.score);
    
    return scoredDocs.slice(0, this.k).map(item => item.document);
  }

  async invoke(input: string): Promise<Document[]> {
    return this._getRelevantDocuments(input);
  }
}
