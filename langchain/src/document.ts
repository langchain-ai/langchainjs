export interface DocumentInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> {
  pageContent: string;

  id?: string;
  metadata?: Metadata;
  sourceType?: string;
  sourceName?: string;
  hash?: string;
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

  id?: string;

  metadata: Metadata;

  sourceType?: string;

  sourceName?: string;

  hash?: string;

  constructor(fields: DocumentInput<Metadata>) {
    this.pageContent = fields.pageContent
      ? fields.pageContent.toString()
      : this.pageContent;
    this.metadata = fields.metadata ?? ({} as Metadata);
    this.sourceType = fields?.sourceType;
    this.sourceName = fields?.sourceName;
    this.hash = fields?.hash;
  }
}
