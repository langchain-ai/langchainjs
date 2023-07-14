import { BaseDocumentCompressor } from "./document_compressors/index.js";
import { Document } from "../document.js";
import { BaseRetriever, BaseRetrieverInput } from "../schema/retriever.js";
import { CallbackManagerForRetrieverRun } from "../callbacks/manager.js";

export interface ContextualCompressionRetrieverArgs extends BaseRetrieverInput {
  baseCompressor: BaseDocumentCompressor;
  baseRetriever: BaseRetriever;
}

export class ContextualCompressionRetriever extends BaseRetriever {
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
    const docs = await this.baseRetriever._getRelevantDocuments(
      query,
      runManager
    );
    const compressedDocs = await this.baseCompressor.compressDocuments(
      docs,
      query
    );
    return compressedDocs;
  }
}
