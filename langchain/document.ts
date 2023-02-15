
interface DocumentParams {
  pageContent: string;

  metadata: Record<string, any>;
}

export class Document implements DocumentParams{
  pageContent: string;

  metadata: Record<string, any>;

  constructor(fields?: Partial<DocumentParams>) {
    this.pageContent = fields?.pageContent ?? this.pageContent;
    this.metadata = fields?.metadata ?? {};
  }

}
