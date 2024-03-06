import { Document } from "@langchain/core/documents";

/**
 * Abstract class for a document store. All document stores should extend
 * this class.
 
 * @inheritDoc
 */
export abstract class Docstore {
  abstract search(search: string): Promise<Document>;

  abstract add(texts: Record<string, Document>): Promise<void>;
}
