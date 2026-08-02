import * as fs from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { BaseFileStore } from "./base.js";

/**
 * Specific implementation of the `BaseFileStore` class for Node.js.
 * Provides methods to read and write files in a specific base path.
 */
export class NodeFileStore extends BaseFileStore {
  lc_namespace = ["langchain", "stores", "file", "node"];

  constructor(public basePath: string = mkdtempSync("langchain-")) {
    super();
  }

  private getFullPath(filePath: string): string {
    const rootPath = resolve(this.basePath);
    const fullPath = resolve(rootPath, filePath);
    const relativePath = relative(rootPath, fullPath);

    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error(
        `Invalid path: ${filePath}. Path should be relative to the base path.`
      );
    }

    return fullPath;
  }

  /**
   * Reads the contents of a file at the given path.
   * @param path Path of the file to read.
   * @returns The contents of the file as a string.
   */
  async readFile(path: string): Promise<string> {
    return await fs.readFile(this.getFullPath(path), "utf8");
  }

  /**
   * Writes the given contents to a file at the specified path.
   * @param path Path of the file to write to.
   * @param contents Contents to write to the file.
   * @returns Promise that resolves when the file has been written.
   */
  async writeFile(path: string, contents: string): Promise<void> {
    await fs.writeFile(this.getFullPath(path), contents, "utf8");
  }
}
