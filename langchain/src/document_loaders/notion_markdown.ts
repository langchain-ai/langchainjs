import { Document } from "../document.js";
import type { readFile as ReadFileT } from "fs/promises";
import { getEnv } from "../util/env.js";
import { BaseDocumentLoader } from "./base.js";
import type { DocumentLoader } from "./base.js";
import glob from "glob";
import path from "path";


export class NotionLoader extends BaseDocumentLoader implements DocumentLoader {
  constructor(public directoryPath: string) {
    super();
  }

  public async load(): Promise<Document[]> {
    const { readFile } = await NotionLoader.imports();
    try {
      const fileNames = await glob("**/*.md", { cwd: this.directoryPath });
      const docs: Document[] = [];
      for (const fileName of fileNames) {
        const filePath = path.join(this.directoryPath, fileName);
        const text = await readFile(filePath, {
          encoding: "utf-8",
        });
        const metadata = { source: fileName };
        docs.push(
          new Document({
            pageContent: text,
            metadata,
          })
        );
      }
      return docs;
    } catch (error) {
      throw new Error(`Could not read directory path ${this.directoryPath} `);
    }
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
        `Failed to load fs/promises. NotionLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
