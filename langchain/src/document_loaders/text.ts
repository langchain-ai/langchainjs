import type { readFile as ReadFileT } from "fs/promises";
import { Document } from "../document.js";
import { getEnv } from "../util/env.js";
import { BaseDocumentLoader } from "./base.js";

export class TextLoader extends BaseDocumentLoader {
  constructor(public filePath: string) {
    super();
  }

  protected async parse(raw: string): Promise<string> {
    return raw;
  }

  public async load(): Promise<Document[]> {
    const { readFile } = await TextLoader.imports();
    const text = await readFile(this.filePath, "utf8");
    const metadata = { source: this.filePath };
    return [new Document({ pageContent: await this.parse(text), metadata })];
  }

  static async imports(): Promise<{
    readFile: typeof ReadFileT;
  }> {
    try {
      const { readFile } = await import("fs/promises");
      return { readFile };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. TextLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
