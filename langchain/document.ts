export interface DocumentParams {
  pageContent: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Interface for interacting with a document.
 */
export class Document implements DocumentParams {
  pageContent: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;

  constructor(fields?: Partial<DocumentParams>) {
    this.pageContent = fields?.pageContent ?? this.pageContent;
    this.metadata = fields?.metadata ?? {};
  }
}
