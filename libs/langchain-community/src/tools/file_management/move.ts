import * as fs from "node:fs/promises";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

/**
 * Schema for MoveFileTool input.
 */
const MoveFileSchema = z.object({
  source_path: z.string().describe("Path of the file to move"),
  destination_path: z.string().describe("New path for the moved file"),
});

/**
 * Tool for moving or renaming files in the file system.
 *
 * This tool provides secure file moving capabilities with optional root directory
 * restriction to prevent directory traversal attacks. Can be used for both moving
 * files to different directories and renaming files.
 *
 * @example
 * ```typescript
 * import { MoveFileTool } from "@langchain/community/tools/file_management";
 *
 * // Create tool with root directory restriction
 * const moveTool = new MoveFileTool({ rootDir: "/safe/directory" });
 *
 * // Move a file to a different directory
 * const result = await moveTool.invoke({
 *   source_path: "old_location/file.txt",
 *   destination_path: "new_location/file.txt"
 * });
 * console.log(result);
 *
 * // Rename a file
 * const renameResult = await moveTool.invoke({
 *   source_path: "old_name.txt",
 *   destination_path: "new_name.txt"
 * });
 * console.log(renameResult);
 * ```
 */
export class MoveFileTool extends FileManagementBaseTool {
  static lc_name() {
    return "MoveFileTool";
  }

  name = "move_file";

  description = "Move or rename a file from one location to another";

  schema = MoveFileSchema;

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

      // Move the file
      await fs.rename(resolvedSourcePath, resolvedDestPath);

      return `File moved successfully from ${source_path} to ${destination_path}.`;
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  }
}

export type MoveFileSchema = {
  source_path: string;
  destination_path: string;
};
