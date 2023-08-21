import { BaseFileStore } from "../../schema/index.js";

/**
 * Class that provides an in-memory file storage system. It extends the
 * BaseFileStore class and implements its readFile and writeFile methods.
 * This class is typically used in scenarios where temporary, in-memory
 * file storage is needed, such as during testing or for caching files in
 * memory for quick access.
 */
export class InMemoryFileStore extends BaseFileStore {
  lc_namespace = ["langchain", "stores", "file", "in_memory"];

  private files: Map<string, string> = new Map();

  /**
   * Retrieves the contents of a file given its path. If the file does not
   * exist, it throws an error.
   * @param path The path of the file to read.
   * @returns The contents of the file as a string.
   */
  async readFile(path: string): Promise<string> {
    const contents = this.files.get(path);
    if (contents === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return contents;
  }

  /**
   * Writes contents to a file at a given path. If the file already exists,
   * it overwrites the existing contents.
   * @param path The path of the file to write.
   * @param contents The contents to write to the file.
   * @returns Void
   */
  async writeFile(path: string, contents: string): Promise<void> {
    this.files.set(path, contents);
  }
}
