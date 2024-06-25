export interface DocumentInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
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
  Metadata extends Record<string, any> = Record<string, any>
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
  Metadata extends Record<string, any> = Record<string, any>
> implements DocumentInput, DocumentInterface
{
  pageContent: string;

  metadata: Metadata;

  // This field is optional at the moment, but may become a required field
  // in the future (wil be assigned automatically if not provided).
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
