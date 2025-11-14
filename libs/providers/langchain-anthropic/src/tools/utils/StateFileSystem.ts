import { FileData } from "./FileData.js";
import { FileSystem } from "./FileSystem.js";

/**
 * Normalizes a path by resolving `.` segments and multiple slashes.
 * Note: `..` segments are not resolved as they are rejected during validation.
 */
function normalize(path: string): string {
  // Split by slashes and filter out empty segments
  const parts = path.split("/").filter((part) => part !== "");

  // Resolve `.` segments
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === ".") {
      // Skip current directory segments
      continue;
    }
    resolved.push(part);
  }

  // Join back with single slashes
  return `/${resolved.join("/")}`;
}

/**
 * State-based file system implementation.
 * Uses LangGraph state for storage.
 */
export class StateFileSystem implements FileSystem {
  constructor(
    private files: Record<string, FileData>,
    private allowedPrefixes: string[] | undefined,
    private updateFiles: (files: Record<string, FileData | null>) => void
  ) {}

  async readFile(path: string): Promise<FileData | null> {
    return this.files[path] || null;
  }

  async listDirectory(path: string): Promise<string[]> {
    // Ensure path ends with / for directory matching
    const dir = path.endsWith("/") ? path : `${path}/`;

    const matchingFiles: string[] = [];
    for (const filePath of Object.keys(this.files)) {
      if (filePath.startsWith(dir)) {
        // Get relative path from directory
        const relative = filePath.slice(dir.length);
        // Only include direct children (no subdirectories)
        if (!relative.includes("/")) {
          matchingFiles.push(filePath);
        }
      }
    }

    return matchingFiles.sort();
  }

  async writeFile(path: string, data: FileData): Promise<void> {
    this.updateFiles({ [path]: data });
  }

  async deleteFile(path: string): Promise<void> {
    this.updateFiles({ [path]: null });
  }

  async renameFile(
    oldPath: string,
    newPath: string,
    existingData: FileData
  ): Promise<void> {
    const now = new Date().toISOString();
    this.updateFiles({
      [oldPath]: null,
      [newPath]: { ...existingData, modified_at: now },
    });
  }

  validatePath(path: string): string {
    // Reject paths with traversal attempts
    if (path.includes("..") || path.startsWith("~")) {
      throw new Error(`Path traversal not allowed: ${path}`);
    }

    // Normalize path (resolve ., //, etc.)
    let normalized = normalize(path);

    // Convert to forward slashes for consistency
    normalized = normalized.replace(/\\/g, "/");

    // Ensure path starts with /
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }

    // Check allowed prefixes if specified
    if (this.allowedPrefixes !== undefined && this.allowedPrefixes.length > 0) {
      const allowed = this.allowedPrefixes.some((prefix) =>
        normalized.startsWith(prefix)
      );
      if (!allowed) {
        throw new Error(
          `Path must start with one of ${JSON.stringify(
            this.allowedPrefixes
          )}: ${path}`
        );
      }
    }

    return normalized;
  }
}
