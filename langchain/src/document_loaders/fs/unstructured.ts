import type { basename as BasenameT } from "node:path";
import type { readFile as ReaFileT } from "node:fs/promises";
import { DirectoryLoader, UnknownHandling } from "./directory.js";
import { getEnv } from "../../util/env.js";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

interface Element {
  type: string;
  text: string;
  // this is purposefully loosely typed
  metadata: {
    [key: string]: unknown;
  };
}

interface UnstructuredOptions {
  apiKey?: string;
}

export class UnstructuredLoader extends BaseDocumentLoader {
  constructor(
    public filePath: string,
    public webPath: string = "https://api.unstructured.io/general/v0/general",
    public options: UnstructuredOptions = {}
  ) {
    super();

    this.filePath = filePath;
    this.webPath = webPath;
    this.options = options;
  }

  async _partition() {
    const { readFile, basename } = await this.imports();

    const buffer = await readFile(this.filePath);
    const fileName = basename(this.filePath);

    // I'm aware this reads the file into memory first, but we have lots of work
    // to do on then consuming Documents in a streaming fashion anyway, so not
    // worried about this for now.
    const formData = new FormData();
    formData.append("files", new Blob([buffer]), fileName);

    let apiKey = "";
    if ("apiKey" in this.options && typeof this.options.apiKey === "string") {
      apiKey = this.options.apiKey;
    }

    const headers = {
      "Content-Type": "application/json",
      "UNSTRUCTURED-API-KEY": apiKey,
    };

    const response = await fetch(this.webPath, {
      method: "POST",
      body: formData,
      headers,
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
    return elements.filter((el) => typeof el.text === "string") as Element[];
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
    readFile: typeof ReaFileT;
    basename: typeof BasenameT;
  }> {
    try {
      const { readFile } = await import("node:fs/promises");
      const { basename } = await import("node:path");
      return { readFile, basename };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. TextLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}

export class UnstructuredDirectoryLoader extends DirectoryLoader {
  constructor(
    public directoryPath: string,
    public webPath: string = "https://api.unstructured.io/general/v0/general",
    public options: UnstructuredOptions = {},
    public recursive: boolean = true,
    public unknown: UnknownHandling = UnknownHandling.Warn
  ) {
    const loaders = {
      ".txt": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".text": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".pdf": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".docx": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".doc": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".jpg": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".jpeg": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".eml": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".html": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".md": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".pptx": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".ppt": (p: string) => new UnstructuredLoader(webPath, p, options),
      ".msg": (p: string) => new UnstructuredLoader(webPath, p, options),
    };
    super(directoryPath, loaders, recursive, unknown);
  }
}

export { UnknownHandling };
