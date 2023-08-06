import { Document } from "../../document.js";
import { Docstore } from "../../schema/index.js";

export class InMemoryDocstore extends Docstore {
  _docs: Map<string, Document>;

  constructor(docs?: Map<string, Document>) {
    super();
    this._docs = docs ?? new Map();
  }

  async search(search: string): Promise<Document> {
    const result = this._docs.get(search);
    if (!result) {
      throw new Error(`ID ${search} not found.`);
    } else {
      return result;
    }
  }

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

export class SynchronousInMemoryDocstore {
  _docs: Map<string, Document>;

  constructor(docs?: Map<string, Document>) {
    this._docs = docs ?? new Map();
  }

  search(search: string): Document {
    const result = this._docs.get(search);
    if (!result) {
      throw new Error(`ID ${search} not found.`);
    } else {
      return result;
    }
  }

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
