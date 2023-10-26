import { type TextItem } from "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js";

import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import { formatDocumentsAsString } from "../../util/document.js";

/**
 * A document loader for loading data from PDFs.
 */
export class WebPDFLoader extends BaseDocumentLoader {
  protected blob: Blob;

  protected splitPages = true;

  private pdfjs: typeof PDFLoaderImports;

  constructor(
    blob: Blob,
    { splitPages = true, pdfjs = PDFLoaderImports } = {}
  ) {
    super();
    this.blob = blob;
    this.splitPages = splitPages ?? this.splitPages;
    this.pdfjs = pdfjs;
  }

  /**
   * Loads the contents of the PDF as documents.
   * @returns An array of Documents representing the retrieved data.
   */
  async load(): Promise<Document[]> {
    const { getDocument, version } = await this.pdfjs();
    const parsedPdf = await getDocument({
      data: new Uint8Array(await this.blob.arrayBuffer()),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    const meta = await parsedPdf.getMetadata().catch(() => null);

    const documents: Document[] = [];

    for (let i = 1; i <= parsedPdf.numPages; i += 1) {
      const page = await parsedPdf.getPage(i);
      const content = await page.getTextContent();

      if (content.items.length === 0) {
        continue;
      }

      const text = content.items
        .map((item) => (item as TextItem).str)
        .join("\n");

      documents.push(
        new Document({
          pageContent: text,
          metadata: {
            pdf: {
              version,
              info: meta?.info,
              metadata: meta?.metadata,
              totalPages: parsedPdf.numPages,
            },
            loc: {
              pageNumber: i,
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
        pageContent: formatDocumentsAsString(documents),
        metadata: {
          pdf: {
            version,
            info: meta?.info,
            metadata: meta?.metadata,
            totalPages: parsedPdf.numPages,
          },
        },
      }),
    ];

    return documents;
  }
}

async function PDFLoaderImports() {
  try {
    const { default: mod } = await import(
      "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js"
    );
    const { getDocument, version } = mod;
    return { getDocument, version };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load pdf-parse. Please install it with eg. `npm install pdf-parse`."
    );
  }
}
