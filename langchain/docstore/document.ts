
/**
 * This works for now but we should probably use a more robust type
 * for metadata values. I think it should be allowed to be any JSON
 * serializable value.
 * 
 * TODO: Figure out best type for metadata values.
 */

export type Json = string 
  | number 
  | boolean 
  | null 
  | undefined
  | Json[] 
  | { [key: string]: Json };

/**
 *  Since almost all documents have a source, we speici
 */
export type DocumentMetadata = { source?: string } & {[key: string]: Json};

export interface DocumentParams {
  pageContent: string;

  metadata: DocumentMetadata;
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
