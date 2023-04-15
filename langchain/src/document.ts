export interface DocumentParams<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> {
  pageContent: string;

  metadata: Metadata;
}

/**
 * Interface for interacting with a document.
 */
export class Document<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> implements DocumentParams
{
  pageContent: string;

  metadata: Metadata;

  constructor(fields?: Partial<DocumentParams<Metadata>>) {
    this.pageContent = fields?.pageContent
      ? fields.pageContent.toString()
      : this.pageContent;
    this.metadata = fields?.metadata ?? ({} as Metadata);
  }
}
