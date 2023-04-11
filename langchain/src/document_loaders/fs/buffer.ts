import type { readFile as ReadFileT } from "node:fs/promises";
import { Document } from "../../document.js";
import { getEnv } from "../../util/env.js";
import { BaseDocumentLoader } from "../base.js";

export abstract class BufferLoader extends BaseDocumentLoader {
  constructor(public filePathOrBlob: string | Blob) {
    super();
  }

  protected abstract parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]>;

  public async load(): Promise<Document[]> {
    let buffer: Buffer;
    let metadata: Record<string, string>;
    if (typeof this.filePathOrBlob === "string") {
      const { readFile } = await BufferLoader.imports();
      buffer = await readFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    } else {
      buffer = await this.filePathOrBlob
        .arrayBuffer()
        .then((ab) => Buffer.from(ab));
      metadata = { source: "blob", blobType: this.filePathOrBlob.type };
    }
    return this.parse(buffer, metadata);
  }

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
