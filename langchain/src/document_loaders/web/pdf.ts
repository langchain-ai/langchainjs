import {
  Metadata,
  PDFDocumentProxy,
} from "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js";
import { isNode } from "browser-or-node";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import type { DocumentLoader } from "../base.js";

export class PdfWebBaseLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  private splitPages: boolean;

  private urlOrPdfContent: string | Uint8Array;

  protected pdfContent: Uint8Array;

  private pdfjs: typeof PDFLoaderImports;

  constructor(
    urlOrPdfContent: string | Uint8Array,
    {
      splitPages = true,
      pdfjs = PDFLoaderImports,
      workerSrc,
    }: {
      splitPages?: boolean;
      pdfjs?: typeof PDFLoaderImports;
      workerSrc?: string;
    } = {}
  ) {
    super();
    this.urlOrPdfContent = urlOrPdfContent;
    this.pdfjs = pdfjs;
    this.splitPages = splitPages;
  
    if (workerSrc) {
      this.setWorkerSrc(workerSrc).then(() => {
        console.log('Worker source set');
      }).catch((error) => {
        console.error('Failed to set worker source:', error);
      });
    }
  }
  
  private setWorkerSrc(workerSrc: string): Promise<void> {
    return import(
      "pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js"
    ).then(({ default: importedMod }) => {
      const mod = importedMod;
      mod.GlobalWorkerOptions.workerSrc = workerSrc;
    });
  }

  async load(): Promise<Document[]> {
    try {
      let pdfData;
      if (isNode && typeof this.urlOrPdfContent === "string") {
        const response = await fetch(this.urlOrPdfContent);
        pdfData = await response.arrayBuffer();
      } else {
        pdfData = this.urlOrPdfContent;
      }

      const { getDocument, version } = await this.pdfjs();
      const pdf = await getDocument(
        typeof pdfData === "string"
          ? pdfData
          : {
              data: pdfData,
              isEvalSupported: false,
              useSystemFonts: true,
            }
      ).promise;
      const meta = await pdf.getMetadata().catch(() => null);
      const { numPages } = pdf;
      const documents: Document[] = [];

      for (let i = 1; i <= numPages; i+=1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        if (content.items.length === 0) {
          continue;
        }

        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join("\n");

        documents.push(
          new Document({
            pageContent: text,
            metadata: {
              pdf: {
                version,
                info: meta?.info,
                metadata: meta?.metadata,
                totalPages: pdf.numPages,
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
          pageContent: documents.map((doc) => doc.pageContent).join("\n\n"),
          metadata: {
            pdf: {
              version,
              info: meta?.info,
              metadata: meta?.metadata,
              totalPages: pdf.numPages,
            },
          },
        }),
      ];
    } catch (error) {
      throw new Error(`Could not load PDF from data: ${error}`);
    }
  }

  async processPage(
    pdf: PDFDocumentProxy,
    pageIndex: number,
    meta: {
      info: object;
      metadata: Metadata;
    } | null,
    version: string
  ): Promise<Document> {
    const page = await pdf.getPage(pageIndex);
    const pageContent = await page.getTextContent();
    const text = pageContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    return new Document({
      pageContent: text,
      metadata: {
        pdf: {
          version,
          info: meta?.info,
          metadata: meta?.metadata,
          totalPages: pdf.numPages,
        },
        loc: {
          pageNumber: pageIndex,
        },
      },
    });
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
      "Failed to load pdfjs-dist. Please install it with eg. `npm install pdfjs-dist`."
    );
  }
}
