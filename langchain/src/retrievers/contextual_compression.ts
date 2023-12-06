import { BaseDocumentCompressor } from "./document_compressors/index.js";
import { Document } from "../document.js";
import { BaseRetriever, BaseRetrieverInput } from "../schema/retriever.js";
import { CallbackManagerForRetrieverRun } from "../callbacks/manager.js";

/**
 * Interface for the arguments required to construct a
 * ContextualCompressionRetriever. It extends the BaseRetrieverInput
 * interface with two additional fields: baseCompressor and baseRetriever.
 */
export interface ContextualCompressionRetrieverArgs extends BaseRetrieverInput {
  baseCompressor: BaseDocumentCompressor;
  baseRetriever: BaseRetriever;
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

  baseRetriever: BaseRetriever;

  constructor(fields: ContextualCompressionRetrieverArgs) {
    super(fields);

    this.baseCompressor = fields.baseCompressor;
    this.baseRetriever = fields.baseRetriever;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
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
