import * as fs from "node:fs/promises";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

/**
 * Schema for CopyFileTool input.
 */
const CopyFileSchema = z.object({
  source_path: z.string().describe("Path of the file to copy"),
  destination_path: z.string().describe("Path to save the copied file"),
});

/**
 * Tool for copying files in the file system.
 *
 * This tool provides secure file copying capabilities with optional root directory
 * restriction to prevent directory traversal attacks. Preserves file metadata
 * and timestamps when possible.
 *
 * @example
 * ```typescript
 * import { CopyFileTool } from "@langchain/community/tools/file_management";
 *
 * // Create tool with root directory restriction
 * const copyTool = new CopyFileTool({ rootDir: "/safe/directory" });
 *
 * // Copy a file
 * const result = await copyTool.invoke({
 *   source_path: "source.txt",
 *   destination_path: "backup/source_copy.txt"
 * });
 * console.log(result);
 * ```
 */
export class CopyFileTool extends FileManagementBaseTool {
  static lc_name() {
    return "CopyFileTool";
  }

  name = "copy_file";

  description = "Create a copy of a file in a specified location";

  schema = CopyFileSchema;

  protected async _call({
    source_path,
    destination_path,
  }: InferInteropZodOutput<typeof this.schema>): Promise<string> {
    // Validate both paths upfront
    const validationError = this.validateMultiplePaths([
      { name: "source_path", value: source_path },
      { name: "destination_path", value: destination_path },
    ]);

    if (validationError) {
      return validationError;
    }

    try {
      const resolvedSourcePath = this.getRelativePath(source_path);
      const resolvedDestPath = this.getRelativePath(destination_path);

      // Check if source file exists
      try {
        await fs.access(resolvedSourcePath, fs.constants.F_OK);
      } catch {
        return `Error: no such file or directory: ${source_path}`;
      }

      // Copy the file with metadata preservation
      await fs.copyFile(
        resolvedSourcePath,
        resolvedDestPath,
        fs.constants.COPYFILE_FICLONE
      );

      // Try to preserve timestamps (best effort)
      try {
        const stats = await fs.stat(resolvedSourcePath);
        await fs.utimes(resolvedDestPath, stats.atime, stats.mtime);
      } catch {
        // Ignore timestamp preservation errors
      }

      return `File copied successfully from ${source_path} to ${destination_path}.`;
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  }
}

export type CopyFileSchema = {
  source_path: string;
  destination_path: string;
};
