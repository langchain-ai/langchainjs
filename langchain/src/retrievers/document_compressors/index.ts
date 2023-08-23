import { Document } from "../../document.js";

/**
 * Base Document Compression class. All compressors should extend this class.
 */
export abstract class BaseDocumentCompressor {
  /**
   * Abstract method that must be implemented by any class that extends
   * `BaseDocumentCompressor`. This method takes an array of `Document`
   * objects and a query string as parameters and returns a Promise that
   * resolves with an array of compressed `Document` objects.
   * @param documents An array of `Document` objects to be compressed.
   * @param query A query string.
   * @returns A Promise that resolves with an array of compressed `Document` objects.
   */
  abstract compressDocuments(
    documents: Document[],
    query: string
  ): Promise<Document[]>;
}
