import type { readFile as ReadFileT } from "fs/promises";
import { Document } from "../document";
import { BaseDocumentLoader } from "./base";

let readFile: typeof ReadFileT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ readFile } = require("fs/promises"));
} catch {
  // ignore error, will be throw in constructor
}

export class TextLoader extends BaseDocumentLoader {
  constructor(public filePath: string) {
    super();

    /**
     * Throw error at construction time
     * if fs/promises is not installed.
     */
    if (readFile === null) {
      throw new Error("Failed to load fs/promises.`");
    }
  }

  public async load(): Promise<Document[]> {
    if (readFile === null) {
      throw new Error("Failed to load fs/promises.");
    }
    const text = await readFile(this.filePath, "utf8");
    const metadata = { source: this.filePath };
    return [new Document({ pageContent: text, metadata })];
  }
}
