import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

/**
 * Schema for WriteFileTool input.
 */
const WriteFileSchema = z.object({
  file_path: z.string().describe("Path to the file to write"),
  text: z.string().describe("Text content to write to the file"),
  append: z
    .boolean()
    .default(false)
    .describe("Whether to append to an existing file"),
});

/**
 * Tool for writing files to the file system.
 *
 * This tool provides secure file writing capabilities with optional root directory
 * restriction to prevent directory traversal attacks. Supports both write and append modes.
 *
 * @example
 * ```typescript
 * import { WriteFileTool } from "@langchain/community/tools/file_management";
 *
 * // Create tool with root directory restriction
 * const writeTool = new WriteFileTool({ rootDir: "/safe/directory" });
 *
 * // Write to a file
 * const result = await writeTool.invoke({
 *   file_path: "example.txt",
 *   text: "Hello, world!",
 *   append: false
 * });
 * console.log(result);
 *
 * // Append to a file
 * const appendResult = await writeTool.invoke({
 *   file_path: "example.txt",
 *   text: "\nAppended text",
 *   append: true
 * });
 * console.log(appendResult);
 * ```
 */
export class WriteFileTool extends FileManagementBaseTool {
  static lc_name() {
    return "WriteFileTool";
  }

  name = "write_file";

  description = "Write file to disk";

  schema = WriteFileSchema;

  protected async _call({
    file_path,
    text,
    append,
  }: InferInteropZodOutput<typeof this.schema>): Promise<string> {
    try {
      // Validate and resolve the file path
      const resolvedPath = this.getRelativePath(file_path);

      try {
        // Ensure the parent directory exists
        const parentDir = path.dirname(resolvedPath);
        await fs.mkdir(parentDir, { recursive: true });

        // Write or append to the file
        const mode = append ? "a" : "w";
        await fs.writeFile(resolvedPath, text, {
          encoding: "utf-8",
          flag: mode,
        });

        return `File written successfully to ${file_path}.`;
      } catch (error) {
        return `Error: ${(error as Error).message}`;
      }
    } catch (error) {
      return this.handleFileValidationError(error, "file_path", file_path);
    }
  }
}

export type WriteFileSchema = {
  file_path: string;
  text: string;
  append?: boolean;
};
