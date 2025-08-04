import { Document } from "../documents/document.js";
import { BaseDocumentTransformer } from "../documents/transformers.js";

/**
 * Interface that defines the methods for loading and splitting documents.
 */
export interface DocumentLoader {
  load(): Promise<Document[]>;
  loadAndSplit(textSplitter?: BaseDocumentTransformer): Promise<Document[]>;
}

/**
 * Abstract class that provides a default implementation for the
 * loadAndSplit() method from the DocumentLoader interface. The load()
 * method is left abstract and needs to be implemented by subclasses.
 */
export abstract class BaseDocumentLoader implements DocumentLoader {
  /**
   * Loads the documents.
   * @returns A Promise that resolves with an array of Document instances.
   */
  abstract load(): Promise<Document[]>;

  /**
   * @deprecated Use `this.load()` and `splitter.splitDocuments()` individually.
   * Loads the documents and splits them using a specified text splitter.
   * @param textSplitter The TextSplitter instance to use for splitting the loaded documents. Defaults to a RecursiveCharacterTextSplitter instance.
   * @returns A Promise that resolves with an array of Document instances, each split according to the provided TextSplitter.
   */
  async loadAndSplit(splitter?: BaseDocumentTransformer): Promise<Document[]> {
    if (splitter === undefined) {
      throw new Error("You must pass a text splitter to use this method.");
    }
    const docs = await this.load();
    return splitter.invoke(docs);
  }
}
