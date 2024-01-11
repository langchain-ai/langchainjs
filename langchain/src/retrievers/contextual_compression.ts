import {
  BaseRetriever,
  type BaseRetrieverInput,
  type BaseRetrieverInterface,
} from "@langchain/core/retrievers";
import type { DocumentInterface } from "@langchain/core/documents";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { BaseDocumentCompressor } from "./document_compressors/index.js";

/**
 * Interface for the arguments required to construct a
 * ContextualCompressionRetriever. It extends the BaseRetrieverInput
 * interface with two additional fields: baseCompressor and baseRetriever.
 */
export interface ContextualCompressionRetrieverArgs extends BaseRetrieverInput {
  baseCompressor: BaseDocumentCompressor;
  baseRetriever: BaseRetrieverInterface;
}

/**
 * A retriever that wraps a base retriever and compresses the results. It
 * retrieves relevant documents based on a given query and then compresses
 * these documents using a specified document compressor.
 * @example
 * ```typescript
 * const retriever = new ContextualCompressionRetriever({
 *   baseCompressor: new LLMChainExtractor(),
 *   baseRetriever: new HNSWLib().asRetriever(),
 * });
 * const retrievedDocs = await retriever.getRelevantDocuments(
 *   "What did the speaker say about Justice Breyer?",
 * );
 * ```
 */
export class ContextualCompressionRetriever extends BaseRetriever {
  static lc_name() {
    return "ContextualCompressionRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "contextual_compression"];

  baseCompressor: BaseDocumentCompressor;

  baseRetriever: BaseRetrieverInterface;

  constructor(fields: ContextualCompressionRetrieverArgs) {
    super(fields);

    this.baseCompressor = fields.baseCompressor;
    this.baseRetriever = fields.baseRetriever;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<DocumentInterface[]> {
    const docs = await this.baseRetriever.getRelevantDocuments(
      query,
      runManager?.getChild("base_retriever")
    );
    const compressedDocs = await this.baseCompressor.compressDocuments(
      docs,
      query,
      runManager?.getChild("base_compressor")
    );
    return compressedDocs;
  }
}
