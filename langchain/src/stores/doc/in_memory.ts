import { Document } from "@langchain/core/documents";
import { BaseStoreInterface } from "@langchain/core/stores";
import { Docstore } from "./base.js";

/**
 * Class for storing and retrieving documents in memory asynchronously.
 * Extends the Docstore class.
 */
export class InMemoryDocstore
  extends Docstore
  implements BaseStoreInterface<string, Document>
{
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

  async mget(keys: string[]): Promise<Document[]> {
    return Promise.all(keys.map((key) => this.search(key)));
  }

  async mset(keyValuePairs: [string, Document][]): Promise<void> {
    await Promise.all(
      keyValuePairs.map(([key, value]) => this.add({ [key]: value }))
    );
  }

  async mdelete(_keys: string[]): Promise<void> {
    throw new Error("Not implemented.");
  }

  // eslint-disable-next-line require-yield
  async *yieldKeys(_prefix?: string): AsyncGenerator<string> {
    throw new Error("Not implemented");
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
