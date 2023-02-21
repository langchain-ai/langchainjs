import type { readFile as ReadFileT } from "fs/promises";
import type SRTParserT from "srt-parser-2";
import { Document } from "../document";
import { BaseDocumentLoader } from "./base";

let readFile: typeof ReadFileT | null = null;
let SRTParser2: typeof SRTParserT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ readFile } = require("fs/promises"));
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ SRTParser2 } = require("srt-parser-2"));
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
      const {
        isBrowser,
        isNode,
        isWebWorker,
        isJsDom,
        isDeno,
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
      } = require("browser-or-node");
      let env: string;
      if (isBrowser) {
        env = "browser";
      } else if (isNode) {
        env = "node";
      } else if (isWebWorker) {
        env = "webworker";
      } else if (isJsDom) {
        env = "jsdom";
      } else if (isDeno) {
        env = "deno";
      } else {
        env = "other";
      }
      throw new Error(
        `Failed to load fs/promises. SRTLoader available only on environment 'node'. It appears you are running environment '${env}'. See https://<link to docs> for alternatives.`
      );
    }

    /**
     * Throw error at construction time
     * if srt-parser-2 is not installed.
     */
    if (SRTParser2 === null) {
      throw new Error(
        "Please install srt-parser-2 as a dependency with, e.g. `yarn add srt-parser-2`"
      );
    }
  }

  public async load(): Promise<Document[]> {
    if (readFile === null) {
      throw new Error("Failed to load fs/promises.");
    }

    if (SRTParser2 === null) {
      throw new Error(
        "Please install srt-parser-2 as a dependency with, e.g. `yarn add srt-parser-2`"
      );
    }

    const file = await readFile(this.filePath, "utf8");
    const parser = new SRTParser2();
    const srts = parser.fromSrt(file);
    const text = srts.map((srt) => srt.text).join(" ");
    const metadata = { source: this.filePath };
    return [new Document({ pageContent: text, metadata })];
  }
}
