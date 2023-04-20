import * as fs from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";

import { BaseFileStore } from "../../schema/index.js";

export class NodeFileStore extends BaseFileStore {
  constructor(public basePath: string = mkdtempSync("langchain-")) {
    super();
  }

  async readFile(path: string): Promise<string> {
    return await fs.readFile(join(this.basePath, path), "utf8");
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await fs.writeFile(join(this.basePath, path), contents, "utf8");
  }
}
