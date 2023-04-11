import { Document } from "../../document.js";
import { BufferLoader } from "./buffer.js";

export class DocxLoader extends BufferLoader {
  constructor(filePathOrBlob: string | Blob) {
    super(filePathOrBlob);
  }

  public async parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]> {
    const { extractRawText } = await DocxLoaderImports();
    const docx = await extractRawText({
      buffer: raw,
    });
    return [
      new Document({
        pageContent: docx.value,
        metadata,
      }),
    ];
  }
}

async function DocxLoaderImports() {
  try {
    const { default: mod } = await import("mammoth");
    const { extractRawText } = mod;
    return { extractRawText };
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load mammoth. Please install it with eg. `npm install mammoth`."
    );
  }
}
