import * as path from "node:path";
import { StructuredTool, ToolParams } from "@langchain/core/tools";

/**
 * Template for invalid path error messages.
 */
export const INVALID_PATH_TEMPLATE =
  "Error: Access denied to {arg_name}: {value}. " +
  "Permission granted exclusively to the current working directory";

/**
 * Error class for paths outside the root directory.
 */
export class FileValidationError extends Error {
  static name = "FileValidationErrorName";

  constructor(message: string) {
    super(message);

    this.name = FileValidationError.name;
  }
}

/**
 * Check if a path is relative to a root directory.
 * This is a TypeScript implementation of Python's Path.is_relative_to()
 */
export function isRelativeTo(targetPath: string, rootPath: string): boolean {
  try {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(rootPath);
    const relativePath = path.relative(resolvedRoot, resolvedTarget);

    // If the relative path starts with '..' or is absolute, it's outside the root
    return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
  } catch {
    return false;
  }
}

/**
 * Get a validated relative path, raising an error if not within the root directory.
 * This prevents directory traversal attacks.
 */
export function getValidatedRelativePath(
  rootDir: string,
  userPath: string
): string {
  // Resolve the root directory to an absolute path
  const resolvedRoot = path.resolve(rootDir);

  // Resolve the full path by joining root with user path
  const fullPath = path.resolve(resolvedRoot, userPath);

  // Check if the resolved path is within the root directory
  if (!isRelativeTo(fullPath, resolvedRoot)) {
    throw new FileValidationError(
      `Path ${userPath} is outside of the allowed directory ${resolvedRoot}`
    );
  }

  return fullPath;
}

/**
 * Interface for file management tool parameters.
 */
export interface FileManagementBaseToolParams extends ToolParams {
  /**
   * The root directory for file operations. If specified, all file paths
   * will be resolved relative to this directory for security.
   */
  rootDir?: string;
}

/**
 * Base class for file management tools that provides shared functionality.
 * This follows the same pattern as GmailBaseTool for consistency.
 */
export abstract class FileManagementBaseTool extends StructuredTool {
  name = "FileManagement";

  description = "A tool for secure file system operations";

  protected params: FileManagementBaseToolParams;

  constructor(params: FileManagementBaseToolParams = {}) {
    super(params);
    this.params = params;
  }

  /**
   * Get the relative path, returning an error if unsupported.
   * If rootDir is not specified, returns the path as-is.
   * If rootDir is specified, validates the path is within the root directory.
   */
  protected getRelativePath(filePath: string): string {
    if (this.params.rootDir === undefined) {
      return path.resolve(filePath);
    }
    return getValidatedRelativePath(this.params.rootDir, filePath);
  }

  /**
   * Format an invalid path error message.
   */
  protected formatInvalidPathError(argName: string, value: string): string {
    return INVALID_PATH_TEMPLATE.replace("{arg_name}", argName).replace(
      "{value}",
      value
    );
  }

  /**
   * Handle file validation errors consistently across all tools.
   */
  protected handleFileValidationError(
    error: unknown,
    argName: string,
    value: string
  ): string {
    if ((error as Error)?.name === FileValidationError.name) {
      return this.formatInvalidPathError(argName, value);
    }
    return `Error: ${(error as Error).message}`;
  }

  /**
   * Validate multiple file paths and return appropriate error messages.
   * Used by tools that operate on multiple paths (copy, move).
   */
  protected validateMultiplePaths(
    paths: Array<{ name: string; value: string }>
  ): string | null {
    for (const { name, value } of paths) {
      try {
        this.getRelativePath(value);
      } catch (error) {
        if ((error as Error)?.name === FileValidationError.name) {
          return this.formatInvalidPathError(name, value);
        }
        return `Error: ${(error as Error).message}`;
      }
    }
    return null;
  }
}
