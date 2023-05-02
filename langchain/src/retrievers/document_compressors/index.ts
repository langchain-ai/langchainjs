import { Document } from "../../document.js";

/**
 * Base Document Compression class. All compressors should extend this class.
 */
export abstract class BaseDocumentCompressor {
  abstract compressDocuments(
    documents: Document[],
    query: string
  ): Promise<Document[]>;
}
