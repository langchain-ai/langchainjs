import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import globToRegexp from "glob-to-regexp";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

/**
 * Schema for FileSearchTool input.
 */
const FileSearchSchema = z.object({
  dir_path: z.string().default(".").describe("Subdirectory to search in"),
  pattern: z
    .string()
    .describe("Unix shell glob pattern, where * matches everything"),
});

/**
 * Recursively search for files matching a pattern.
 */
async function searchFiles(
  dirPath: string,
  pattern: RegExp,
  basePath: string
): Promise<string[]> {
  const matches: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile() && pattern.test(entry.name)) {
        // Get relative path from the base search directory
        const relativePath = path.relative(basePath, fullPath);
        matches.push(relativePath);
      } else if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subMatches = await searchFiles(fullPath, pattern, basePath);
        matches.push(...subMatches);
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    // Ignore permission errors and continue searching, but throw others
    if (code !== "EACCES" && code !== "EPERM") {
      throw error;
    }
  }

  return matches;
}

/**
 * Tool for recursively searching files in a subdirectory that match a glob pattern.
 *
 * This tool provides secure file searching capabilities with optional root directory
 * restriction to prevent directory traversal attacks. Uses Unix shell glob patterns
 * where * matches any characters and ? matches a single character.
 *
 * @example
 * ```typescript
 * import { FileSearchTool } from "@langchain/community/tools/file_management";
 *
 * // Create tool with root directory restriction
 * const searchTool = new FileSearchTool({ rootDir: "/safe/directory" });
 *
 * // Search for all .txt files
 * const result = await searchTool.invoke({
 *   dir_path: ".",
 *   pattern: "*.txt"
 * });
 * console.log(result);
 *
 * // Search for files starting with "test"
 * const testResult = await searchTool.invoke({
 *   dir_path: "src",
 *   pattern: "test*"
 * });
 * console.log(testResult);
 * ```
 */
export class FileSearchTool extends FileManagementBaseTool {
  static lc_name() {
    return "FileSearchTool";
  }

  name = "file_search";

  description =
    "Recursively search for files in a subdirectory that match the glob pattern";

  schema = FileSearchSchema;

  protected async _call({
    dir_path,
    pattern,
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

        // Convert glob pattern to regex
        const regex = globToRegexp(pattern);

        // Search for matching files
        const matches = await searchFiles(resolvedPath, regex, resolvedPath);

        if (matches.length === 0) {
          return `No files found for pattern ${pattern} in directory ${dir_path}`;
        }

        // Sort matches for consistent output
        matches.sort();

        return matches.join("\n");
      } catch (error) {
        return `Error: ${(error as Error).message}`;
      }
    } catch (error) {
      return this.handleFileValidationError(error, "dir_path", dir_path);
    }
  }
}

export type FileSearchSchema = {
  dir_path?: string;
  pattern: string;
};
