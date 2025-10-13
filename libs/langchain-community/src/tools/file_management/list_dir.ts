import * as fs from "node:fs/promises";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

/**
 * Schema for ListDirectoryTool input.
 */
const ListDirectorySchema = z.object({
  dir_path: z.string().default(".").describe("Subdirectory to list"),
});

/**
 * Tool for listing files and directories in a specified folder.
 *
 * This tool provides secure directory listing capabilities with optional root directory
 * restriction to prevent directory traversal attacks. Lists both files and directories
 * in the specified path.
 *
 * @example
 * ```typescript
 * import { ListDirectoryTool } from "@langchain/community/tools/file_management";
 *
 * // Create tool with root directory restriction
 * const listTool = new ListDirectoryTool({ rootDir: "/safe/directory" });
 *
 * // List current directory
 * const result = await listTool.invoke({ dir_path: "." });
 * console.log(result);
 *
 * // List a subdirectory
 * const subResult = await listTool.invoke({ dir_path: "subdirectory" });
 * console.log(subResult);
 * ```
 */
export class ListDirectoryTool extends FileManagementBaseTool {
  static lc_name() {
    return "ListDirectoryTool";
  }

  name = "list_directory";

  description = "List files and directories in a specified folder";

  schema = ListDirectorySchema;

  protected async _call({
    dir_path,
  }: InferInteropZodOutput<typeof this.schema>): Promise<string> {
    try {
      // Validate and resolve the directory path
      const resolvedPath = this.getRelativePath(dir_path);

      try {
        // Check if directory exists and is accessible
        try {
          await fs.access(resolvedPath, fs.constants.F_OK);
        } catch {
          return `Error: no such file or directory: ${dir_path}`;
        }

        // Check if it's actually a directory
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          return `Error: ${dir_path} is not a directory`;
        }

        // List directory contents
        const entries = await fs.readdir(resolvedPath);

        if (entries.length === 0) {
          return `No files found in directory ${dir_path}`;
        }

        // Sort entries for consistent output
        entries.sort();

        return entries.join("\n");
      } catch (error) {
        return `Error: ${(error as Error).message}`;
      }
    } catch (error) {
      return this.handleFileValidationError(error, "dir_path", dir_path);
    }
  }
}

export type ListDirectorySchema = {
  dir_path?: string;
};
