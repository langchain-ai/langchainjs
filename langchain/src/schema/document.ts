import { Document } from "../document.js";
import { Serializable } from "../load/serializable.js";

/**
 * Abstract base class for document transformation systems.
 *
 * A document transformation system takes an array of Documents and returns an
 * array of transformed Documents. These arrays do not necessarily have to have
 * the same length.
 *
 * One example of this is a text splitter that splits a large document into
 * many smaller documents.
 */
export abstract class BaseDocumentTransformer extends Serializable {
  lc_namespace = ["langchain", "document_transformers"];

  /**
   * Transform a list of documents.
   * @param documents A sequence of documents to be transformed.
   * @returns A list of transformed documents.
   */
  abstract transformDocuments(documents: Document[]): Promise<Document[]>;
}
