import { BaseDocumentCompressor } from "@langchain/core/retrievers/document_compressors/base";

export interface CohereRerankArgs {};

/**
 * Document compressor that uses `Cohere Rerank API`.
 */
export class CohereRerank extends BaseDocumentCompressor {
  constructor() {
    super();
  }
}