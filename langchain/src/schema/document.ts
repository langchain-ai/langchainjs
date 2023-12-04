import { BaseDocumentTransformer } from "@langchain/core/documents";
import { Document } from "../document.js";

export { BaseDocumentTransformer };

/**
 * Class for document transformers that return exactly one transformed document
 * for each input document.
 */
export abstract class MappingDocumentTransformer extends BaseDocumentTransformer {
  async transformDocuments(documents: Document[]): Promise<Document[]> {
    const newDocuments = [];
    for (const document of documents) {
      const transformedDocument = await this._transformDocument(document);
      newDocuments.push(transformedDocument);
    }
    return newDocuments;
  }

  abstract _transformDocument(document: Document): Promise<Document>;
}
