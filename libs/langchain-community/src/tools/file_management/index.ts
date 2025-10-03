/**
 * File Management Tools
 *
 * This module provides a comprehensive set of tools for secure file system operations
 * including reading, writing, copying, moving, deleting, listing, and searching files.
 *
 * All tools support optional root directory restriction to prevent directory traversal
 * attacks and ensure operations are contained within a safe directory.
 *
 * @example
 * ```typescript
 * import {
 *   ReadFileTool,
 *   WriteFileTool,
 *   CopyFileTool,
 *   DeleteFileTool,
 *   MoveFileTool,
 *   ListDirectoryTool,
 *   FileSearchTool
 * } from "@langchain/community/tools/file_management";
 *
 * // Create tools with root directory restriction for security
 * const rootDir = "/safe/working/directory";
 *
 * const readTool = new ReadFileTool({ rootDir });
 * const writeTool = new WriteFileTool({ rootDir });
 * const copyTool = new CopyFileTool({ rootDir });
 * const deleteTool = new DeleteFileTool({ rootDir });
 * const moveTool = new MoveFileTool({ rootDir });
 * const listTool = new ListDirectoryTool({ rootDir });
 * const searchTool = new FileSearchTool({ rootDir });
 *
 * // Use the tools
 * const content = await readTool.invoke({ file_path: "example.txt" });
 * await writeTool.invoke({ file_path: "output.txt", text: "Hello, world!" });
 * const files = await listTool.invoke({ dir_path: "." });
 * const matches = await searchTool.invoke({ dir_path: ".", pattern: "*.txt" });
 * ```
 */

export { ReadFileTool } from "./read.js";
export { WriteFileTool } from "./write.js";
export { CopyFileTool } from "./copy.js";
export { DeleteFileTool } from "./delete.js";
export { DeleteDirectoryTool } from "./delete_dir.js";
export { MoveFileTool } from "./move.js";
export { ListDirectoryTool } from "./list_dir.js";
export { FileSearchTool } from "./file_search.js";

// Export base class and types following Gmail pattern
export type { FileManagementBaseToolParams } from "./base.js";
export type { ReadFileSchema } from "./read.js";
export type { WriteFileSchema } from "./write.js";
export type { CopyFileSchema } from "./copy.js";
export type { DeleteFileSchema } from "./delete.js";
export type { DeleteDirectorySchema } from "./delete_dir.js";
export type { MoveFileSchema } from "./move.js";
export type { ListDirectorySchema } from "./list_dir.js";
export type { FileSearchSchema } from "./file_search.js";

export {
  FileManagementBaseTool,
  FileValidationError,
  getValidatedRelativePath,
  isRelativeTo,
  INVALID_PATH_TEMPLATE,
} from "./base.js";

/**
 * Array of all available file management tools for easy access.
 */
export const ALL_FILE_MANAGEMENT_TOOLS = [
  "ReadFileTool",
  "WriteFileTool",
  "CopyFileTool",
  "DeleteFileTool",
  "DeleteDirectoryTool",
  "MoveFileTool",
  "ListDirectoryTool",
  "FileSearchTool",
] as const;

/**
 * Type representing all available file management tool names.
 */
export type FileManagementToolName = (typeof ALL_FILE_MANAGEMENT_TOOLS)[number];
