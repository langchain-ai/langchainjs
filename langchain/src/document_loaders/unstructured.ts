import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";

interface Element {
  type: string;
  text: string;
  // this is purposefully loosely typed
  metadata: {
    [key: string]: unknown;
  };
}

export class UnstructuredLoader extends BaseDocumentLoader {
  constructor(public webPath: string, public filePath: string) {
    super();
    this.filePath = filePath;

    this.webPath = webPath;
  }

  async _partition() {
    const { readFile } = await this.imports();

    const buffer = await readFile(this.filePath);

    // I'm aware this reads the file into memory first, but we have lots of work
    // to do on then consuming Documents in a streaming fashion anyway, so not
    // worried about this for now.
    const formData = new FormData();
    formData.append("files", new Blob([buffer]));

    const response = await fetch(this.webPath, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to partition file ${this.filePath} with error ${
          response.status
        } and message ${await response.text()}`
      );
    }

    const elements = await response.json();
    if (!Array.isArray(elements)) {
      throw new Error(
        `Expected partitioning request to return an array, but got ${elements}`
      );
    }
    return elements as Element[];
  }

  async load(): Promise<Document[]> {
    const elements = await this._partition();

    const documents: Document[] = [];
    for (const element of elements) {
      const { metadata, text } = element;
      documents.push(
        new Document({
          pageContent: text,
          metadata: {
            ...metadata,
            category: element.type,
          },
        })
      );
    }

    return documents;
  }

  async imports(): Promise<{
    readFile: typeof import("fs/promises")["readFile"];
  }> {
    const { readFile } = await import("fs/promises");
    return { readFile };
  }
}
