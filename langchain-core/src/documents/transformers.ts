import { Runnable } from "../runnables/base.js";
import type { BaseCallbackConfig } from "../callbacks/manager.js";
import type { DocumentInterface } from "./document.js";

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
export abstract class BaseDocumentTransformer<
  RunInput extends DocumentInterface[] = DocumentInterface[],
  RunOutput extends DocumentInterface[] = DocumentInterface[]
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain_core", "documents", "transformers"];

  /**
   * Transform a list of documents.
   * @param documents A sequence of documents to be transformed.
   * @returns A list of transformed documents.
   */
  abstract transformDocuments(documents: RunInput): Promise<RunOutput>;

  /**
   * Method to invoke the document transformation. This method calls the
   * transformDocuments method with the provided input.
   * @param input The input documents to be transformed.
   * @param _options Optional configuration object to customize the behavior of callbacks.
   * @returns A Promise that resolves to the transformed documents.
   */
  invoke(input: RunInput, _options?: BaseCallbackConfig): Promise<RunOutput> {
    return this.transformDocuments(input);
  }
}

/**
 * Class for document transformers that return exactly one transformed document
 * for each input document.
 */
export abstract class MappingDocumentTransformer extends BaseDocumentTransformer {
  async transformDocuments(
    documents: DocumentInterface[]
  ): Promise<DocumentInterface[]> {
    const newDocuments = [];
    for (const document of documents) {
      const transformedDocument = await this._transformDocument(document);
      newDocuments.push(transformedDocument);
    }
    return newDocuments;
  }

  abstract _transformDocument(
    document: DocumentInterface
  ): Promise<DocumentInterface>;
}
