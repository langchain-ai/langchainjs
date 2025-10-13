import * as fs from "node:fs/promises";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { FileManagementBaseTool } from "./base.js";

const DeleteDirectorySchema = z.object({
  dir_path: z.string().describe("Path of the directory to delete"),
  recursive: z
    .boolean()
    .default(false)
    .describe(
      "If true, deletes the directory and all its contents recursively"
    ),
});

export class DeleteDirectoryTool extends FileManagementBaseTool {
  static lc_name() {
    return "DeleteDirectoryTool";
  }

  name = "delete_directory";

  description =
    "Delete a directory. Fails if the directory is not empty, unless recursive is true.";

  schema = DeleteDirectorySchema;

  protected async _call({
    dir_path,
    recursive,
  }: InferInteropZodOutput<typeof this.schema>): Promise<string> {
    try {
      const resolvedPath = this.getRelativePath(dir_path);

      try {
        await fs.access(resolvedPath, fs.constants.F_OK);
      } catch {
        return `Error: no such directory: ${dir_path}`;
      }

      const stats = await fs.stat(resolvedPath);

      if (!stats.isDirectory()) {
        return `Error: ${dir_path} is not a directory.`;
      }

      if (recursive) {
        await fs.rm(resolvedPath, { recursive: true });
      } else {
        await fs.rmdir(resolvedPath);
      }

      return `Directory deleted successfully: ${dir_path}.`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOTEMPTY") {
        return `Error: Directory ${dir_path} is not empty. Use 'recursive: true' to delete it.`;
      }
      return this.handleFileValidationError(error, "dir_path", dir_path);
    }
  }
}

export type DeleteDirectorySchema = {
  dir_path: string;
  recursive?: boolean;
};
