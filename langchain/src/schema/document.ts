import { Document } from "../document.js";
import { Serializable } from "../load/serializable.js";

export abstract class BaseDocumentTransformer extends Serializable {
  lc_namespace = ["langchain", "document_transformers"];

  abstract transformDocuments(documents: Document[]): Promise<Document[]>;
}
