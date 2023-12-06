import type { readFile as ReadFileT } from "node:fs/promises";
import { Document } from "../../document.js";
import { getEnv } from "../../util/env.js";
import { BaseDocumentLoader } from "../base.js";

/**
 * A class that extends the `BaseDocumentLoader` class. It represents a
 * document loader that loads documents from a text file. The `load()`
 * method is implemented to read the text from the file or blob, parse it
 * using the `parse()` method, and create a `Document` instance for each
 * parsed page. The metadata includes the source of the text (file path or
 * blob) and, if there are multiple pages, the line number of each page.
 * @example
 * ```typescript
 * const loader = new TextLoader("src/document_loaders/example_data/example.txt");
 * const docs = await loader.load();
 * ```
 */
export class TextLoader extends BaseDocumentLoader {
  constructor(public filePathOrBlob: string | Blob) {
    super();
  }

  /**
   * A protected method that takes a `raw` string as a parameter and returns
   * a promise that resolves to an array containing the raw text as a single
   * element.
   * @param raw The raw text to be parsed.
   * @returns A promise that resolves to an array containing the raw text as a single element.
   */
  protected async parse(raw: string): Promise<string[]> {
    return [raw];
  }

  /**
   * A method that loads the text file or blob and returns a promise that
   * resolves to an array of `Document` instances. It reads the text from
   * the file or blob using the `readFile` function from the
   * `node:fs/promises` module or the `text()` method of the blob. It then
   * parses the text using the `parse()` method and creates a `Document`
   * instance for each parsed page. The metadata includes the source of the
   * text (file path or blob) and, if there are multiple pages, the line
   * number of each page.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  public async load(): Promise<Document[]> {
    let text: string;
    let metadata: Record<string, string>;
    if (typeof this.filePathOrBlob === "string") {
      const { readFile } = await TextLoader.imports();
      text = await readFile(this.filePathOrBlob, "utf8");
      metadata = { source: this.filePathOrBlob };
    } else {
      text = await this.filePathOrBlob.text();
      metadata = { source: "blob", blobType: this.filePathOrBlob.type };
    }
    const parsed = await this.parse(text);
    parsed.forEach((pageContent, i) => {
      if (typeof pageContent !== "string") {
        throw new Error(
          `Expected string, at position ${i} got ${typeof pageContent}`
        );
      }
    });
    return parsed.map(
      (pageContent, i) =>
        new Document({
          pageContent,
          metadata:
            parsed.length === 1
              ? metadata
              : {
                  ...metadata,
                  line: i + 1,
                },
        })
    );
  }

  /**
   * A static method that imports the `readFile` function from the
   * `node:fs/promises` module. It is used to dynamically import the
   * function when needed. If the import fails, it throws an error
   * indicating that the `fs/promises` module is not available in the
   * current environment.
   * @returns A promise that resolves to an object containing the `readFile` function from the `node:fs/promises` module.
   */
  static async imports(): Promise<{
    readFile: typeof ReadFileT;
  }> {
    try {
      const { readFile } = await import("node:fs/promises");
      return { readFile };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. TextLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
