import type { extname as ExtnameT, resolve as ResolveT } from "path";
import type { readdir as ReaddirT } from "fs/promises";
import { Document } from "../document.js";
import { getEnv } from "../util/env.js";
import { BaseDocumentLoader } from "./base.js";

export enum UnknownHandling {
  Ignore = "ignore",
  Warn = "warn",
  Error = "error",
}

export class DirectoryLoader extends BaseDocumentLoader {
  constructor(
    public directoryPath: string,
    public loaders: {
      [extension: string]: (filePath: string) => BaseDocumentLoader;
    },
    public recursive: boolean = true,
    public unknown: UnknownHandling = UnknownHandling.Warn
  ) {
    super();

    if (Object.keys(loaders).length === 0) {
      throw new Error("Must provide at least one loader");
    }
    for (const extension in loaders) {
      if (Object.hasOwn(loaders, extension)) {
        if (extension[0] !== ".") {
          throw new Error(`Extension must start with a dot: ${extension}`);
        }
      }
    }
  }

  public async load(): Promise<Document[]> {
    const { readdir, extname, resolve } = await DirectoryLoader.imports();
    const files = await readdir(this.directoryPath, { withFileTypes: true });

    const documents = [];

    for (const file of files) {
      const fullPath = resolve(this.directoryPath, file.name);
      if (file.isDirectory()) {
        if (this.recursive) {
          const loader = new DirectoryLoader(
            fullPath,
            this.loaders,
            this.recursive,
            this.unknown
          );
          documents.push(...(await loader.load()));
        }
      } else {
        // I'm aware some things won't be files,
        // but they will be caught by the "unknown" handling below.
        const loaderFactory = this.loaders[extname(file.name)];
        if (loaderFactory) {
          const loader = loaderFactory(fullPath);
          documents.push(...(await loader.load()));
        } else {
          switch (this.unknown) {
            case UnknownHandling.Ignore:
              break;
            case UnknownHandling.Warn:
              console.warn(`Unknown file type: ${file.name}`);
              break;
            case UnknownHandling.Error:
              throw new Error(`Unknown file type: ${file.name}`);
            default:
              throw new Error(`Unknown unknown handling: ${this.unknown}`);
          }
        }
      }
    }

    return documents;
  }

  static async imports(): Promise<{
    readdir: typeof ReaddirT;
    extname: typeof ExtnameT;
    resolve: typeof ResolveT;
  }> {
    try {
      const { extname, resolve } = await import("path");
      const { readdir } = await import("fs/promises");
      return { readdir, extname, resolve };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. DirectoryLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}
