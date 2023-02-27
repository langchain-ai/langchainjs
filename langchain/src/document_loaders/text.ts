import type { readFile as ReadFileT } from "fs/promises";
import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";

export class TextLoader extends BaseDocumentLoader {
  constructor(public filePath: string) {
    super();
  }

  public async load(): Promise<Document[]> {
    const { readFile } = await TextLoader.imports();
    const text = await readFile(this.filePath, "utf8");
    const metadata = { source: this.filePath };
    return [new Document({ pageContent: text, metadata })];
  }

  static async imports(): Promise<{
    readFile: typeof ReadFileT;
  }> {
    try {
      const { readFile } = await import("fs/promises");
      return { readFile };
    } catch (e) {
      console.error(e);
      const {
        isBrowser,
        isNode,
        isWebWorker,
        isJsDom,
        isDeno,
        // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
      } = await import("browser-or-node");
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
        `Failed to load fs/promises. TextLoader available only on environment 'node'. It appears you are running environment '${env}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
