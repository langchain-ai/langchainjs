import * as fs from "node:fs/promises";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

/**
 * Schema for DeleteFileTool input.
 */
const DeleteFileSchema = z.object({
  file_path: z.string().describe("Path of the file to delete"),
});

/**
 * Tool for deleting files from the file system.
 *
 * This tool provides secure file deletion capabilities with optional root directory
 * restriction to prevent directory traversal attacks. Only deletes files, not directories.
 *
 * @example
 * ```typescript
 * import { DeleteFileTool } from "@langchain/community/tools/file_management";
 *
 * // Create tool with root directory restriction
 * const deleteTool = new DeleteFileTool({ rootDir: "/safe/directory" });
 *
 * // Delete a file
 * const result = await deleteTool.invoke({
 *   file_path: "unwanted_file.txt"
 * });
 * console.log(result);
 * ```
 */
export class DeleteFileTool extends FileManagementBaseTool {
  static lc_name() {
    return "DeleteFileTool";
  }

  name = "delete_file";

  description = "Delete a file";

  schema = DeleteFileSchema;

  protected async _call({
    file_path,
  }: InferInteropZodOutput<typeof this.schema>): Promise<string> {
    try {
      // Validate and resolve the file path
      const resolvedPath = this.getRelativePath(file_path);

      try {
        // Check if file exists
        try {
          await fs.access(resolvedPath, fs.constants.F_OK);
        } catch {
          return `Error: no such file or directory: ${file_path}`;
        }

        // Check if it's a file (not a directory)
        const stats = await fs.stat(resolvedPath);
        if (!stats.isFile()) {
          return `Error: ${file_path} is not a file`;
        }

        // Delete the file
        await fs.unlink(resolvedPath);

        return `File deleted successfully: ${file_path}.`;
      } catch (error) {
        return `Error: ${(error as Error).message}`;
      }
    } catch (error) {
      return this.handleFileValidationError(error, "file_path", file_path);
    }
  }
}

export type DeleteFileSchema = {
  file_path: string;
};
