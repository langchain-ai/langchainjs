import { Document } from "../document.js";

export abstract class Docstore {
  abstract search(search: string): Promise<Document>;

  abstract add(texts: Record<string, Document>): Promise<void>;
}

export abstract class SynchronousDocstore {
  abstract search(search: string): Document | string;

  abstract add(texts: Record<string, Document>): void;
}
