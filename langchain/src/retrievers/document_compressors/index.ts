import { Document } from "../../document.js";
import { BaseDocumentTransformer } from "../../schema/document.js";
import { Callbacks } from "../../callbacks/manager.js";

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
    query: string,
    callbacks?: Callbacks
  ): Promise<Document[]>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static isBaseDocumentCompressor(x: any): x is BaseDocumentCompressor {
    return x?.compressDocuments !== undefined;
  }
}

/**
 * Document compressor that uses a pipeline of Transformers.
 */
export class DocumentCompressorPipeline extends BaseDocumentCompressor {
  transformers: (BaseDocumentTransformer | BaseDocumentCompressor)[];

  constructor(fields: {
    transformers: (BaseDocumentTransformer | BaseDocumentCompressor)[];
  }) {
    super();
    this.transformers = fields.transformers;
  }

  async compressDocuments(
    documents: Document[],
    query: string,
    callbacks?: Callbacks
  ): Promise<Document[]> {
    let transformedDocuments = documents;
    for (const transformer of this.transformers) {
      if (BaseDocumentCompressor.isBaseDocumentCompressor(transformer)) {
        transformedDocuments = await transformer.compressDocuments(
          transformedDocuments,
          query,
          callbacks
        );
      } else {
        transformedDocuments = await transformer.transformDocuments(
          transformedDocuments
        );
      }
    }
    return transformedDocuments;
  }
}
