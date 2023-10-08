export interface DocumentInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> {
  pageContent: string;

  metadata?: Metadata;
}

/**
 * Interface for interacting with a document.
 */

export class Document<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> implements DocumentInput
{
  pageContent: string;

  metadata: Metadata;

  /**
   * Constructs a new Document instance.
   *
   * @param fields - The input fields for the Document. `pageContent` must not be empty.
   * You may optionally include `metadata`.
   * @throws {Error} Throws an error if `pageContent` is not provided or is empty.
   */
  constructor(fields: DocumentInput<Metadata>) {
    if (!fields.pageContent) throw new Error("pageContents must not be empty");
    this.pageContent = fields.pageContent.toString();
    this.metadata = fields.metadata ?? ({} as Metadata);
  }
}
