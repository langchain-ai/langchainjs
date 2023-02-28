import type { readFile as ReadFileT } from "fs/promises";
import type SRTParserT from "srt-parser-2";
import { Document } from "../document.js";
import { getEnv } from "../util/env.js";
import { BaseDocumentLoader } from "./base.js";

export class SRTLoader extends BaseDocumentLoader {
  constructor(public filePath: string) {
    super();

    this.filePath = filePath;
  }

  public async load(): Promise<Document[]> {
    const { readFile, SRTParser2 } = await SRTLoader.imports();
    const file = await readFile(this.filePath, "utf8");
    const parser = new SRTParser2();
    const srts = parser.fromSrt(file);
    const text = srts.map((srt) => srt.text).join(" ");
    const metadata = { source: this.filePath };
    return [new Document({ pageContent: text, metadata })];
  }

  static async imports(): Promise<{
    readFile: typeof ReadFileT;
    SRTParser2: typeof SRTParserT.default;
  }> {
    let readFile: typeof ReadFileT | null = null;
    try {
      readFile = (await import("fs/promises")).readFile;
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. SRTLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }

    let SRTParser2: typeof SRTParserT.default | null = null;
    try {
      SRTParser2 = (await import("srt-parser-2")).default.default;
    } catch (e) {
      throw new Error(
        "Please install srt-parser-2 as a dependency with, e.g. `yarn add srt-parser-2`"
      );
    }
    return { readFile, SRTParser2 };
  }
}
