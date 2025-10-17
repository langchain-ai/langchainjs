export interface DocumentInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>,
> {
  pageContent: string;

  metadata?: Metadata;

  /**
   * An optional identifier for the document.
   *
   * Ideally this should be unique across the document collection and formatted
   * as a UUID, but this will not be enforced.
   */
  id?: string;
}

export interface DocumentInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>,
> {
  pageContent: string;

  metadata: Metadata;

  /**
   * An optional identifier for the document.
   *
   * Ideally this should be unique across the document collection and formatted
   * as a UUID, but this will not be enforced.
   */
  id?: string;
}

/**
 * Interface for interacting with a document.
 */
export class Document<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Metadata extends Record<string, any> = Record<string, any>,
  >
  implements DocumentInput, DocumentInterface
{
  pageContent: string;

  metadata: Metadata;

  // The ID field is optional at the moment.
  // It will likely become required in a future major release after
  // it has been adopted by enough vectorstore implementations.
  /**
   * An optional identifier for the document.
   *
   * Ideally this should be unique across the document collection and formatted
   * as a UUID, but this will not be enforced.
   */
  id?: string;

  constructor(fields: DocumentInput<Metadata>) {
    this.pageContent =
      fields.pageContent !== undefined ? fields.pageContent.toString() : "";
    this.metadata = fields.metadata ?? ({} as Metadata);
    this.id = fields.id;
  }
}
