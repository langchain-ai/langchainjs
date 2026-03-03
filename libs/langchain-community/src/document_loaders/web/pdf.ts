import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

/**
 * A document loader for loading data from PDF blobs.
 *
 * Requires the `pdf-parse` peer dependency (v2):
 * ```bash
 * npm install pdf-parse@^2
 * ```
 *
 * @example
 * ```typescript
 * const loader = new WebPDFLoader(new Blob());
 * const docs = await loader.load();
 * console.log({ docs });
 * ```
 */
export class WebPDFLoader extends BaseDocumentLoader {
  protected blob: Blob;

  protected splitPages = true;

  protected parsedItemSeparator: string;

  constructor(
    blob: Blob,
    {
      splitPages = true,
      parsedItemSeparator = "",
    } = {}
  ) {
    super();
    this.blob = blob;
    this.splitPages = splitPages ?? this.splitPages;
    this.parsedItemSeparator = parsedItemSeparator;
  }

  /**
   * Loads the contents of the PDF as documents.
   * @returns An array of Documents representing the retrieved data.
   */
  async load(): Promise<Document[]> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({
      data: new Uint8Array(await this.blob.arrayBuffer()),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    try {
      const textResult = await parser.getText({
        ...(this.parsedItemSeparator
          ? { itemJoiner: this.parsedItemSeparator }
          : {}),
      });
      const infoResult = await parser.getInfo();

      const documents: Document[] = [];

      for (const page of textResult.pages) {
        if (!page.text) {
          continue;
        }

        documents.push(
          new Document({
            pageContent: page.text,
            metadata: {
              pdf: {
                info: infoResult.info,
                metadata: infoResult.metadata,
                totalPages: textResult.total,
              },
              loc: {
                pageNumber: page.num,
              },
            },
          })
        );
      }

      if (this.splitPages) {
        return documents;
      }

      if (documents.length === 0) {
        return [];
      }

      return [
        new Document({
          pageContent: documents.map((doc) => doc.pageContent).join("\n\n"),
          metadata: {
            pdf: {
              info: infoResult.info,
              metadata: infoResult.metadata,
              totalPages: textResult.total,
            },
          },
        }),
      ];
    } finally {
      await parser.destroy();
    }
  }
}
