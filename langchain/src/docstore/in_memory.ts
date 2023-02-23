import { Document } from "../document.js";
import { Docstore } from "./base.js";

export class InMemoryDocstore extends Docstore {
  _docs: Map<string, Document>;

  constructor(docs?: Map<string, Document>) {
    super();
    this._docs = docs ?? new Map();
  }

  /** Method for getting count of documents in _docs */
  get count() {
    return this._docs.size;
  }

  search(search: string): Document | string {
    return this._docs.get(search) ?? `ID ${search} not found.`;
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
