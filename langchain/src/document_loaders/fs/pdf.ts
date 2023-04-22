import type { TextItem } from "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js";
import { Document } from "../../document.js";
import { BufferLoader } from "./buffer.js";

export class PDFLoader extends BufferLoader {
  private splitPages: boolean;

  private pdfjs: typeof PDFLoaderImports;

  constructor(
    filePathOrBlob: string | Blob,
    { splitPages = true, pdfjs = PDFLoaderImports } = {}
  ) {
    super(filePathOrBlob);
    this.splitPages = splitPages;
    this.pdfjs = pdfjs;
  }

  public async parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]> {
    const { getDocument, version } = await this.pdfjs();
    const pdf = await getDocument({
      data: new Uint8Array(raw.buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    const meta = await pdf.getMetadata().catch(() => null);

    const documents: Document[] = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      if (content.items.length === 0) {
        continue;
      }

      let lastY: number | undefined;
      let text = "";
      // Adapted from https://gitlab.com/autokent/pdf-parse/-/blob/master/lib/pdf-parse.js#L21
      // https://github.com/mozilla/pdf.js/issues/8963
      // https://github.com/mozilla/pdf.js/issues/2140
      // https://gist.github.com/hubgit/600ec0c224481e910d2a0f883a7b98e3
      // https://gist.github.com/hubgit/600ec0c224481e910d2a0f883a7b98e3
      for (const item of content.items) {
        // eslint-disable-next-line eqeqeq
        if (lastY == (item as TextItem)?.transform[5] || !lastY) {
          text += (item as TextItem).str;
        } else {
          text += `\n${(item as TextItem).str}`;
        }
        // eslint-disable-next-line prefer-destructuring
        lastY = (item as TextItem).transform[5];
      }

      documents.push(
        new Document({
          pageContent: text,
          metadata: {
            ...metadata,
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
          ...metadata,
          pdf: {
            version,
            info: meta?.info,
            metadata: meta?.metadata,
            totalPages: pdf.numPages,
          },
        },
      }),
    ];
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
