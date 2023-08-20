import { Document } from "../../document.js";
import { Docstore } from "../../schema/index.js";

/**
 * Class for storing and retrieving documents in memory asynchronously.
 * Extends the Docstore class.
 */
export class InMemoryDocstore extends Docstore {
  _docs: Map<string, Document>;

  constructor(docs?: Map<string, Document>) {
    super();
    this._docs = docs ?? new Map();
  }

  /**
   * Searches for a document in the store based on its ID.
   * @param search The ID of the document to search for.
   * @returns The document with the given ID.
   */
  async search(search: string): Promise<Document> {
    const result = this._docs.get(search);
    if (!result) {
      throw new Error(`ID ${search} not found.`);
    } else {
      return result;
    }
  }

  /**
   * Adds new documents to the store.
   * @param texts An object where the keys are document IDs and the values are the documents themselves.
   * @returns Void
   */
  async add(texts: Record<string, Document>): Promise<void> {
    const keys = [...this._docs.keys()];
    const overlapping = Object.keys(texts).filter((x) => keys.includes(x));

    if (overlapping.length > 0) {
      throw new Error(`Tried to add ids that already exist: ${overlapping}`);
    }

    for (const [key, value] of Object.entries(texts)) {
      this._docs.set(key, value);
    }
  }
}

/**
 * Class for storing and retrieving documents in memory synchronously.
 */
export class SynchronousInMemoryDocstore {
  _docs: Map<string, Document>;

  constructor(docs?: Map<string, Document>) {
    this._docs = docs ?? new Map();
  }

  /**
   * Searches for a document in the store based on its ID.
   * @param search The ID of the document to search for.
   * @returns The document with the given ID.
   */
  search(search: string): Document {
    const result = this._docs.get(search);
    if (!result) {
      throw new Error(`ID ${search} not found.`);
    } else {
      return result;
    }
  }

  /**
   * Adds new documents to the store.
   * @param texts An object where the keys are document IDs and the values are the documents themselves.
   * @returns Void
   */
  add(texts: Record<string, Document>): void {
    const keys = [...this._docs.keys()];
    const overlapping = Object.keys(texts).filter((x) => keys.includes(x));

    if (overlapping.length > 0) {
      throw new Error(`Tried to add ids that already exist: ${overlapping}`);
    }

    for (const [key, value] of Object.entries(texts)) {
      this._docs.set(key, value);
    }
  }
}
