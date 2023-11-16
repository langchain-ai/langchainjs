import {
  RecursiveCharacterTextSplitter,
  TextSplitter,
} from "../text_splitter.js";
import { Document } from "../document.js";

/**
 * Interface that defines the methods for loading and splitting documents.
 */
export interface DocumentLoader {
  load(): Promise<Document[]>;
  loadAndSplit(textSplitter?: TextSplitter): Promise<Document[]>;
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
   * Loads the documents and splits them using a specified text splitter.
   * @param textSplitter The TextSplitter instance to use for splitting the loaded documents. Defaults to a RecursiveCharacterTextSplitter instance.
   * @returns A Promise that resolves with an array of Document instances, each split according to the provided TextSplitter.
   */
  async loadAndSplit(
    splitter: TextSplitter = new RecursiveCharacterTextSplitter()
  ): Promise<Document[]> {
    const docs = await this.load();
    return splitter.splitDocuments(docs);
  }
}
