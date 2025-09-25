import * as fs from "node:fs/promises";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

/**
 * Schema for ReadFileTool input.
 */
const ReadFileSchema = z.object({
  file_path: z.string().describe("Path to the file to read"),
});

/**
 * Tool for reading files from the file system.
 *
 * This tool provides secure file reading capabilities with optional root directory
 * restriction to prevent directory traversal attacks.
 *
 * @example
 * ```typescript
 * import { ReadFileTool } from "@langchain/community/tools/file_management";
 *
 * // Create tool with root directory restriction
 * const readTool = new ReadFileTool({ rootDir: "/safe/directory" });
 *
 * // Read a file
 * const content = await readTool.invoke({ file_path: "example.txt" });
 * console.log(content);
 * ```
 */
export class ReadFileTool extends FileManagementBaseTool {
  static lc_name() {
    return "ReadFileTool";
  }

  name = "read_file";

  description = "Read file from disk";

  schema = ReadFileSchema;

  protected async _call({
    file_path,
  }: InferInteropZodOutput<typeof this.schema>): Promise<string> {
    try {
      // Validate and resolve the file path
      const resolvedPath = this.getRelativePath(file_path);

      // Check if file exists
      try {
        await fs.access(resolvedPath, fs.constants.F_OK);
      } catch {
        return `Error: no such file or directory: ${file_path}`;
      }

      // Read the file
      try {
        return await fs.readFile(resolvedPath, "utf-8");
      } catch (error) {
        return `Error: ${(error as Error).message}`;
      }
    } catch (error) {
      return this.handleFileValidationError(error, "file_path", file_path);
    }
  }
}

export type ReadFileSchema = {
  file_path: string;
};
