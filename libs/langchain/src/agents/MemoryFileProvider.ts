import { type FileProvider } from "./middleware/codeExecution.js";

/**
 * Simple in-memory file provider for testing and development.
 * Stores file contents in memory and assigns incremental IDs.
 */
export class MemoryFileProvider implements FileProvider {
  private files: { [key: string]: Buffer } = {};
  private idCounter = 0;

  async addFile(content: Buffer): Promise<string> {
    const fileId = `file-${this.idCounter++}`;
    this.files[fileId] = content;
    return fileId;
  }

  async readFile(fileId: string): Promise<Buffer> {
    return this.files[fileId];
  }
}
