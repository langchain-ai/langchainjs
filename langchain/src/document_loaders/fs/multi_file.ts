import { extname, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { type LoadersMapping, UnknownHandling } from "./directory.js";

/**
 * A document loader that loads documents from multiple files. It extends the
 * `BaseDocumentLoader` class and implements the `load()` method.
 * @example
 * ```typescript
 *
 * const multiFileLoader = new MultiFileLoader(
 *   ["path/to/file1.pdf", "path/to/file2.txt"],
 *   {
 *     ".pdf": (path: string) => new PDFLoader(path),
 *   },
 * );
 *
 * const docs = await multiFileLoader.load();
 * console.log({ docs });
 *
 * ```
 */
export class MultiFileLoader extends BaseDocumentLoader {
  constructor(
    public filePaths: string[],
    public loaders: LoadersMapping,
    public unknown: UnknownHandling = UnknownHandling.Warn
  ) {
    super();

    if (Object.keys(loaders).length === 0) {
      throw new Error("Must provide at least one loader");
    }
    for (const extension in loaders) {
      if (Object.hasOwn(loaders, extension)) {
        if (extension[0] !== ".") {
          throw new Error(`Extension must start with a dot: ${extension}`);
        }
      }
    }
  }

  /**
   * Loads the documents from the provided file paths. It checks if the file
   * is a directory and ignores it. If a file is a file, it checks if there
   * is a corresponding loader function for the file extension in the `loaders`
   * mapping. If there is, it loads the documents. If there is no
   * corresponding loader function and `unknown` is set to `Warn`, it logs a
   * warning message. If `unknown` is set to `Error`, it throws an error.
   * @returns A promise that resolves to an array of loaded documents.
   */
  public async load(): Promise<Document[]> {
    const documents: Document[] = [];

    for (const filePath of this.filePaths) {
      const fullPath = resolve(filePath);
      const fileStat = await stat(fullPath);

      if (fileStat.isDirectory()) {
        console.warn(`Ignoring directory: ${fullPath}`);
        continue;
      }

      const loaderFactory = this.loaders[extname(fullPath)];
      if (loaderFactory) {
        const loader = loaderFactory(fullPath);
        documents.push(...(await loader.load()));
      } else {
        switch (this.unknown) {
          case UnknownHandling.Ignore:
            break;
          case UnknownHandling.Warn:
            console.warn(`Unknown file type: ${fullPath}`);
            break;
          case UnknownHandling.Error:
            throw new Error(`Unknown file type: ${fullPath}`);
          default:
            throw new Error(`Unknown unknown handling: ${this.unknown}`);
        }
      }
    }

    return documents;
  }
}
