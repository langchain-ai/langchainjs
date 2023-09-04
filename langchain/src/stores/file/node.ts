import * as fs from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";

import { BaseFileStore } from "../../schema/index.js";

/**
 * Specific implementation of the `BaseFileStore` class for Node.js.
 * Provides methods to read and write files in a specific base path.
 */
export class NodeFileStore extends BaseFileStore {
  lc_namespace = ["langchain", "stores", "file", "node"];

  constructor(public basePath: string = mkdtempSync("langchain-")) {
    super();
  }

  /**
   * Reads the contents of a file at the given path.
   * @param path Path of the file to read.
   * @returns The contents of the file as a string.
   */
  async readFile(path: string): Promise<string> {
    return await fs.readFile(join(this.basePath, path), "utf8");
  }

  /**
   * Writes the given contents to a file at the specified path.
   * @param path Path of the file to write to.
   * @param contents Contents to write to the file.
   * @returns Promise that resolves when the file has been written.
   */
  async writeFile(path: string, contents: string): Promise<void> {
    await fs.writeFile(join(this.basePath, path), contents, "utf8");
  }
}
