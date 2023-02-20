import type { readFile as ReadFileT } from "fs/promises";
import type SRTParserT from "srt-parser-2";
import { Document } from "../docstore/document";
import { BaseDocumentLoader } from "./base";

let readFile: typeof ReadFileT | null = null;
let SRTParser: typeof SRTParserT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ readFile } = require("fs/promises"));
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  SRTParser = require("srt-parser-2");
} catch {
  // ignore error, will be throw in constructor
}

export class SRTLoader extends BaseDocumentLoader {
  constructor(public filePath: string) {
    super();

    /**
     * Throw error at construction time
     * if fs/promises is not installed.
     */
    if (readFile === null) {
      throw new Error("Failed to load fs/promises.`");
    }

    /**
     * Throw error at construction time
     * if srt-parser-2 is not installed.
     */
    if (SRTParser === null) {
      throw new Error(
        "Please install srt-parser-2 as a dependency with, e.g. `yarn add srt-parser-2`"
      );
    }
  }

  public async load(): Promise<Document[]> {
    if (readFile === null) {
      throw new Error("Failed to load fs/promises.");
    }

    if (SRTParser === null) {
      throw new Error(
        "Please install srt-parser-2 as a dependency with, e.g. `yarn add srt-parser-2`"
      );
    }

    const file = await readFile(this.filePath, "utf8");
    const parser = new SRTParser();
    const srts = parser.fromSrt(file);
    const text = srts.map((srt) => srt.text).join(" ");
    const metadata = { source: this.filePath };
    return [new Document({ pageContent: text, metadata })];
  }
}
