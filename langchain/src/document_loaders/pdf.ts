// the main entrypoint has some debug code that we don't want to import
import pdf from "pdf-parse/lib/pdf-parse.js";
import { Document } from "../document.js";
import { BufferLoader } from "./buffer.js";

export class PDFLoader extends BufferLoader {
  public async parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]> {
    const parsed = await pdf(raw);
    return [
      new Document({
        pageContent: parsed.text,
        metadata: {
          ...metadata,
          pdf: {
            info: parsed.info,
            metadata: parsed.metadata,
            numpages: parsed.numpages,
          },
        },
      }),
    ];
  }
}
