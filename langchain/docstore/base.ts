import { Document } from './document';

export type DocstoreKey = string | number;

export abstract class Docstore {
  abstract search(search: DocstoreKey): Document | string;

  abstract add(texts: Record<DocstoreKey, Document>): void;
}
