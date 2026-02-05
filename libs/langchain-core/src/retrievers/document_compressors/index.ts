import { Callbacks } from "../../callbacks/manager.js";
import { DocumentInterface } from "../../documents/document.js";

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
    documents: DocumentInterface[],
    query: string,
    callbacks?: Callbacks
  ): Promise<DocumentInterface[]>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static isBaseDocumentCompressor(x: any): x is BaseDocumentCompressor {
    return x?.compressDocuments !== undefined;
  }
}
