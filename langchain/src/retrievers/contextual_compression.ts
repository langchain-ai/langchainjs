import { BaseDocumentCompressor } from "./document_compressors/index.js";
import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";

export interface ContextualCompressionRetrieverArgs {
  baseCompressor: BaseDocumentCompressor;
  baseRetriever: BaseRetriever;
}

export class ContextualCompressionRetriever extends BaseRetriever {
  baseCompressor: BaseDocumentCompressor;

  baseRetriever: BaseRetriever;

  constructor({
    baseCompressor,
    baseRetriever,
  }: ContextualCompressionRetrieverArgs) {
    super();

    this.baseCompressor = baseCompressor;
    this.baseRetriever = baseRetriever;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const docs = await this.baseRetriever.getRelevantDocuments(query);
    const compressedDocs = await this.baseCompressor.compressDocuments(
      docs,
      query
    );
    return compressedDocs;
  }
}
