import {Document} from "../../document.js";
import {BufferLoader} from "./buffer.js";

/**
 * A class that extends the `BufferLoader` class. It represents a document
 * loader that loads documents from PDF files.
 */
export class PPTXLoader extends BufferLoader {
  constructor(filePathOrBlob: string | Blob) {
    super(filePathOrBlob);
  }

  /**
   * A method that takes a `raw` buffer and `metadata` as parameters and
   * returns a promise that resolves to an array of `Document` instances. It
   * uses the `parseOfficeAsync` function from the `officeparser` module to extract
   * the raw text content from the buffer. If the extracted powerpoint content is
   * empty, it returns an empty array. Otherwise, it creates a new
   * `Document` instance with the extracted powerpoint content and the provided
   * metadata, and returns it as an array.
   * @param raw The buffer to be parsed.
   * @param metadata The metadata of the document.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  public async parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]> {
    const {parseOfficeAsync} = await PPTLoaderImports();
    const pptx = await parseOfficeAsync(raw, {outputErrorToConsole: true});

    if (!pptx) return [];

    return [
      new Document({
        pageContent: pptx,
        metadata
      }),
    ];
  }
}

async function PPTLoaderImports() {
  try {
    const {default: mod} = await import("officeparser");
    const {parseOfficeAsync} = mod;
    return {parseOfficeAsync};
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load officeparser. Please install it with eg. `npm install officeparser`."
    );
  }
}
