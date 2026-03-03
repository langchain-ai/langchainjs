import { Document } from "@langchain/core/documents";
import { BufferLoader } from "@langchain/classic/document_loaders/fs/buffer";

/**
 * A document loader that loads documents from PDF files.
 *
 * Requires the `pdf-parse` peer dependency (v2):
 * ```bash
 * npm install pdf-parse@^2
 * ```
 *
 * @example
 * ```typescript
 * const loader = new PDFLoader("path/to/bitcoin.pdf");
 * const docs = await loader.load();
 * console.log({ docs });
 * ```
 */
export class PDFLoader extends BufferLoader {
  private splitPages: boolean;

  protected parsedItemSeparator: string;

  constructor(
    filePathOrBlob: string | Blob,
    {
      splitPages = true,
      parsedItemSeparator = "",
    } = {}
  ) {
    super(filePathOrBlob);
    this.splitPages = splitPages;
    this.parsedItemSeparator = parsedItemSeparator;
  }

  /**
   * A method that takes a `raw` buffer and `metadata` as parameters and
   * returns a promise that resolves to an array of `Document` instances. It
   * uses the `PDFParse` class from the pdf-parse library to extract text
   * content from the PDF. It creates a new `Document` instance for each
   * page with the extracted text content and metadata, and adds it to the
   * `documents` array. If `splitPages` is `true`, it returns the array of
   * `Document` instances. Otherwise, if there are no documents, it returns
   * an empty array. Otherwise, it concatenates the page content of all
   * documents and creates a single `Document` instance with the
   * concatenated content.
   * @param raw The buffer to be parsed.
   * @param metadata The metadata of the document.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  public async parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]> {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({
      data: new Uint8Array(raw.buffer),
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
              ...metadata,
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
            ...metadata,
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
