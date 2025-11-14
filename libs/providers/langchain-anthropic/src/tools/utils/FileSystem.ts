import { FileData } from "./FileData.js";

/**
 * Abstract interface for file system operations.
 * Supports both state-based (LangGraph) and physical filesystem implementations.
 */
export interface FileSystem {
  /**
   * Read a file's contents and metadata.
   * @param path - Normalized path to the file
   * @returns FileData if file exists, null if not found or is a directory
   */
  readFile(path: string): Promise<FileData | null>;

  /**
   * List files in a directory.
   * @param path - Normalized path to the directory
   * @returns Array of file paths in the directory
   */
  listDirectory(path: string): Promise<string[]>;

  /**
   * Write a file with content and metadata.
   * @param path - Normalized path to write
   * @param data - File data to write
   * @returns Result with message and optional state updates
   */
  writeFile(path: string, data: FileData): Promise<void>;

  /**
   * Delete a file or directory.
   * @param path - Normalized path to delete
   * @returns Result with message and optional state updates
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Rename/move a file or directory.
   * @param oldPath - Normalized source path
   * @param newPath - Normalized destination path
   * @param existingData - File data to move
   * @returns Result with message and optional state updates
   */
  renameFile(
    oldPath: string,
    newPath: string,
    existingData: FileData
  ): Promise<void>;

  /**
   * Validate and normalize a file path.
   * @param path - Path to validate
   * @returns Normalized path
   * @throws Error if path is invalid
   */
  validatePath(path: string): string;
}
