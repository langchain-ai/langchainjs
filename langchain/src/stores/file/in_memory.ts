import { BaseFileStore } from "../../schema/index.js";

export class InMemoryFileStore extends BaseFileStore {
  private files: Map<string, string> = new Map();

  async readFile(path: string): Promise<string> {
    const contents = this.files.get(path);
    if (contents === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return contents;
  }

  async writeFile(path: string, contents: string): Promise<void> {
    this.files.set(path, contents);
  }
}
