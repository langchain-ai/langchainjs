import { Document } from './document';
import { Docstore, DocstoreKey } from './base';

export class InMemoryDocstore extends Docstore {
  private _docs: Map<DocstoreKey, Document>;

  constructor() {
    super();
    this._docs = new Map();
  }

  search(search: DocstoreKey): Document | string {
    return this._docs.get(search) ?? `ID ${search} not found.`;
  }

  add(texts: Record<DocstoreKey, Document>): void {
    const keys = [...this._docs.keys()];
    const overlapping = Object.keys(texts).filter(x => keys.includes(x));

    if (overlapping.length > 0) {
      throw new Error(`Tried to add ids that already exist: ${overlapping}`);
    }

    for (const [key, value] of Object.entries(texts)) {
      this._docs.set(key, value);
    }
  }
}