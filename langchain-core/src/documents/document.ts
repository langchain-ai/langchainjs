export interface DocumentInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> {
  pageContent: string;

  metadata?: Metadata;
  // Custom payload for vectorstores for an extra parameter to filter for
  customPayload?: object;
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

  customPayload?: object | undefined;

  constructor(fields: DocumentInput<Metadata>) {
    this.pageContent = fields.pageContent
      ? fields.pageContent.toString()
      : this.pageContent;
    this.metadata = fields.metadata ?? ({} as Metadata);
  }
}
