import { Serializable } from "../load/serializable.js";

export interface DocumentInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> {
  pageContent: string;

  metadata?: Metadata;
}

export interface DocumentInterface<
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
> extends Serializable implements DocumentInput, DocumentInterface
{
  static lc_name(): string {
    return "Document"
  }

  get lc_aliases(): Record<string, string> {
    return {
      pageContent: "page_content",
    };
  }

  lc_namespace = ["langchain_core", "documents", "base"];

  pageContent: string;

  metadata: Metadata;

  constructor(fields: DocumentInput<Metadata>) {
    super(fields);
    this.pageContent = fields.pageContent
      ? fields.pageContent.toString()
      : this.pageContent;
    this.metadata = fields.metadata ?? ({} as Metadata);
  }
}
