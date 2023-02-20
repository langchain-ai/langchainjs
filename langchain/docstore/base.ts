import { Document } from "../document";

export abstract class Docstore {
  abstract search(search: string): Document | string;

  abstract add(texts: Record<string, Document>): void;
}
