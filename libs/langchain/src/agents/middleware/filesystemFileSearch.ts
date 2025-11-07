import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";

import { createMiddleware } from "../index.js";

const execFileAsync = promisify(execFile);

const OUTPUT_MODES = ["files_with_matches", "content", "count"] as const;
type OutputMode = (typeof OUTPUT_MODES)[number];

/**
 * Expands brace patterns like `*.{ts,tsx}` into a list of globs.
 */
function expandIncludePatterns(pattern: string): string[] | null {
  if (pattern.includes("}") && !pattern.includes("{")) {
    return null;
  }

  const expanded: string[] = [];

  function expand(current: string): void {
    const start = current.indexOf("{");
    if (start === -1) {
      expanded.push(current);
      return;
    }

    const end = current.indexOf("}", start);
    if (end === -1) {
      throw new Error("Unmatched brace");
    }

    const prefix = current.slice(0, start);
    const suffix = current.slice(end + 1);
    const inner = current.slice(start + 1, end);
    if (!inner) {
      throw new Error("Empty brace pattern");
    }

    for (const option of inner.split(",")) {
      expand(prefix + option + suffix);
    }
  }

  try {
    expand(pattern);
  } catch {
    return null;
  }

  return expanded;
}

/**
 * Validates glob pattern used for include filters.
 */
function isValidIncludePattern(pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  if (
    pattern.includes("\x00") ||
    pattern.includes("\n") ||
    pattern.includes("\r")
  ) {
    return false;
  }

  const expanded = expandIncludePatterns(pattern);
  if (!expanded) {
    return false;
  }

  try {
    // Validate that each expanded pattern can be converted to a regex
    for (const candidate of expanded) {
      // Simple validation - check if it's a valid glob pattern
      // In a real implementation, you might want to use a proper glob library
      new RegExp(candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Returns true if the basename matches the include pattern.
 */
function matchIncludePattern(basename: string, pattern: string): boolean {
  const expanded = expandIncludePatterns(pattern);
  if (!expanded) {
    return false;
  }

  return expanded.some((candidate) => {
    // Simple glob matching - convert glob pattern to regex
    const regexPattern = candidate
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*/g, ".*")
      .replace(/\\\?/g, ".");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(basename);
  });
}

/**
 * Simple glob matching function that handles ** patterns
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Handle ** pattern - matches across directory boundaries
  if (pattern.includes("**")) {
    // Convert glob pattern to regex
    // First, escape all special regex characters
    let regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Replace escaped ** with .* (matches any characters including slashes)
    regexPattern = regexPattern.replace(/\\\*\\\*/g, ".*");

    // Replace escaped single * with [^/]* (matches any characters except slashes)
    regexPattern = regexPattern.replace(/\\\*/g, "[^/]*");

    // Replace escaped ? with . (matches any single character except slashes)
    regexPattern = regexPattern.replace(/\\\?/g, "[^/]");

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  // For non-** patterns, check both full path and basename
  const basename = path.basename(filePath);
  let regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  regexPattern = regexPattern.replace(/\\\*/g, "[^/]*");
  regexPattern = regexPattern.replace(/\\\?/g, "[^/]");
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath) || regex.test(basename);
}

/**
 * Recursively find files matching a glob pattern
 */
async function findFilesMatchingPattern(
  basePath: string,
  pattern: string,
  rootPath: string
): Promise<Array<{ virtualPath: string; modifiedAt: string }>> {
  const results: Array<{ virtualPath: string; modifiedAt: string }> = [];

  async function walkDir(
    dirPath: string,
    relativePath: string = ""
  ): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeFilePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath, relativeFilePath);
      } else if (entry.isFile()) {
        // Check if file matches pattern
        if (matchGlob(relativeFilePath, pattern)) {
          try {
            const stats = await fs.stat(fullPath);
            const virtualPath = `/${path
              .relative(rootPath, fullPath)
              .replace(/\\/g, "/")}`;
            const modifiedAt = new Date(stats.mtime).toISOString();
            results.push({ virtualPath, modifiedAt });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  }

  await walkDir(basePath);
  return results;
}

export interface FilesystemFileSearchMiddlewareConfig {
  /**
   * Root directory to search.
   */
  rootPath: string;
  /**
   * Whether to use ripgrep for search.
   * Falls back to Node.js based search if ripgrep unavailable.
   *
   * @see https://github.com/BurntSushi/ripgrep
   * @default false
   */
  useRipgrep?: boolean;
  /**
   * Maximum file size to search in MB (default: 10).
   */
  maxFileSizeMb?: number;
}

/**
 * Provides Glob and Grep search over filesystem files.
 *
 * This middleware adds two tools that search through local filesystem:
 * - Glob: Fast file pattern matching by file path
 * - Grep: Fast content search using ripgrep or JavaScript fallback
 *
 * @example
 * ```typescript
 * import { createAgent } from "langchain";
 * import { filesystemFileSearchMiddleware } from "langchain/agents/middleware";
 *
 * const agent = createAgent({
 *   model: model,
 *   tools: [],
 *   middleware: [
 *     filesystemFileSearchMiddleware({ rootPath: "/workspace" }),
 *   ],
 * });
 * ```
 */
export function filesystemFileSearchMiddleware(
  config: FilesystemFileSearchMiddlewareConfig
) {
  const rootPath = path.resolve(config.rootPath);
  const useRipgrep = config.useRipgrep ?? false;
  const maxFileSizeBytes = (config.maxFileSizeMb ?? 10) * 1024 * 1024;

  /**
   * Validates and resolves a virtual path to filesystem path.
   */
  function validateAndResolvePath(virtualPath: string): string {
    // Normalize path
    let normalizedPath = virtualPath;
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }

    // Check for path traversal
    if (normalizedPath.includes("..") || normalizedPath.includes("~")) {
      throw new Error("Path traversal not allowed");
    }

    // Convert virtual path to filesystem path
    const relative = normalizedPath.replace(/^\//, "");
    const fullPath = path.resolve(rootPath, relative);

    // Ensure path is within root
    if (!fullPath.startsWith(rootPath)) {
      throw new Error(`Path outside root directory: ${normalizedPath}`);
    }

    return fullPath;
  }

  /**
   * Search using ripgrep subprocess.
   */
  async function ripgrepSearch(
    pattern: string,
    basePath: string,
    include?: string
  ): Promise<Map<string, Array<[number, string]>>> {
    try {
      const baseFull = validateAndResolvePath(basePath);
      const stats = await fs.stat(baseFull);
      if (!stats.isDirectory()) {
        return new Map();
      }
    } catch {
      return new Map();
    }

    const cmd = ["rg", "--json"];
    if (include) {
      cmd.push("--glob", include);
    }
    cmd.push("--", pattern, validateAndResolvePath(basePath));

    try {
      const { stdout } = await execFileAsync("rg", cmd.slice(1), {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });

      const results = new Map<string, Array<[number, string]>>();
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type === "match") {
            const filePath = data.data.path.text;
            const virtualPath = `/${path
              .relative(rootPath, filePath)
              .replace(/\\/g, "/")}`;
            const lineNum = data.data.line_number;
            const lineText = data.data.lines.text.replace(/\n$/, "");

            if (!results.has(virtualPath)) {
              results.set(virtualPath, []);
            }
            results.get(virtualPath)!.push([lineNum, lineText]);
          }
        } catch {
          // Skip invalid JSON lines
          continue;
        }
      }
      return results;
    } catch {
      // Fallback to JavaScript search if ripgrep unavailable or times out
      return nodeSearch(pattern, basePath, include);
    }
  }

  /**
   * Search using JavaScript regex (fallback).
   */
  async function nodeSearch(
    pattern: string,
    basePath: string,
    include?: string
  ): Promise<Map<string, Array<[number, string]>>> {
    try {
      const baseFull = validateAndResolvePath(basePath);
      const stats = await fs.stat(baseFull);
      if (!stats.isDirectory()) {
        return new Map();
      }
    } catch {
      return new Map();
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return new Map();
    }

    const results = new Map<string, Array<[number, string]>>();

    async function walkDir(dirPath: string): Promise<void> {
      let entries;
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        /**
         * Check include filter
         */
        if (include && !matchIncludePattern(entry.name, include)) {
          continue;
        }

        /**
         * Skip files that are too large
         */
        let stats;
        try {
          stats = await fs.stat(fullPath);
          if (stats.size > maxFileSizeBytes) {
            continue;
          }
        } catch {
          continue;
        }

        let content: string;
        try {
          content = await fs.readFile(fullPath, "utf-8");
        } catch {
          /**
           * Skip files we can't read
           */
          continue;
        }

        // Search content
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const virtualPath = `/${path
              .relative(rootPath, fullPath)
              .replace(/\\/g, "/")}`;
            if (!results.has(virtualPath)) {
              results.set(virtualPath, []);
            }
            results.get(virtualPath)!.push([i + 1, lines[i]]);
          }
        }
      }
    }

    await walkDir(validateAndResolvePath(basePath));
    return results;
  }

  /**
   * Format grep results based on output mode.
   *
   * @param results - The results of the grep search.
   * @param outputMode - The output mode to use.
   * @returns The formatted results.
   */
  function formatGrepResults(
    results: Map<string, [number, string][]>,
    outputMode: OutputMode
  ): string {
    const sortedFiles = Array.from(results.keys()).sort();

    if (outputMode === "files_with_matches") {
      return sortedFiles.join("\n") || "No matches found";
    }

    if (outputMode === "content") {
      const lines: string[] = [];
      for (const filePath of sortedFiles) {
        const matches = results.get(filePath)!;
        for (const [lineNum, line] of matches) {
          lines.push(`${filePath}:${lineNum}:${line}`);
        }
      }
      return lines.join("\n") || "No matches found";
    }

    if (outputMode === "count") {
      const lines: string[] = [];
      for (const filePath of sortedFiles) {
        const count = results.get(filePath)!.length;
        lines.push(`${filePath}:${count}`);
      }
      return lines.join("\n") || "No matches found";
    }

    return sortedFiles.join("\n") || "No matches found";
  }

  const globSearch = tool(
    async ({ pattern, path: searchPath = "/" }) => {
      try {
        const baseFull = validateAndResolvePath(searchPath);
        const stats = await fs.stat(baseFull);
        if (!stats.isDirectory()) {
          return "No files found";
        }
      } catch {
        return "No files found";
      }

      const matching = await findFilesMatchingPattern(
        validateAndResolvePath(searchPath),
        pattern,
        rootPath
      );

      if (matching.length === 0) {
        return "No files found";
      }

      // Sort by modification time (most recent first)
      matching.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

      return matching.map((m) => m.virtualPath).join("\n");
    },
    {
      name: "glob_search",
      description: `Fast file pattern matching tool that works with any codebase size.

Supports glob patterns like **/*.js or src/**/*.ts.
Returns matching file paths sorted by modification time.
Use this tool when you need to find files by name patterns.`,
      schema: z.object({
        pattern: z
          .string()
          .describe("The glob pattern to match files against."),
        path: z
          .string()
          .default("/")
          .describe(
            "The directory to search in. If not specified, searches from root."
          ),
      }),
    }
  );

  const grepSearch = tool(
    async ({
      pattern,
      path: searchPath = "/",
      include = undefined,
      output_mode = "files_with_matches",
    }) => {
      // Compile regex pattern (for validation)
      try {
        new RegExp(pattern);
      } catch (e) {
        const errorMessage =
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : String(e);
        return `Invalid regex pattern: ${errorMessage}`;
      }

      if (include && !isValidIncludePattern(include)) {
        return "Invalid include pattern";
      }

      // Try ripgrep first if enabled
      let results: Map<string, [number, string][]> | undefined;
      if (useRipgrep) {
        try {
          results = await ripgrepSearch(pattern, searchPath, include);
        } catch {
          // Fallback to JavaScript search
          results = undefined;
        }
      }

      // JavaScript fallback if ripgrep failed or is disabled
      if (typeof results === "undefined") {
        results = await nodeSearch(pattern, searchPath, include);
      }

      if (results.size === 0) {
        return "No matches found";
      }

      // Format output based on mode
      return formatGrepResults(results, output_mode);
    },
    {
      name: "grep_search",
      description: `Fast content search tool that works with any codebase size.

Searches file contents using regular expressions. Supports full regex
syntax and filters files by pattern with the include parameter.`,
      schema: z.object({
        pattern: z
          .string()
          .describe(
            "The regular expression pattern to search for in file contents."
          ),
        path: z
          .string()
          .default("/")
          .describe(
            "The directory to search in. If not specified, searches from root."
          ),
        include: z
          .string()
          .optional()
          .describe('File pattern to filter (e.g., "*.js", "*.{ts,tsx}").'),
        output_mode: z
          .enum(OUTPUT_MODES)
          .default("files_with_matches")
          .describe(
            `Output format:
- "files_with_matches": Only file paths containing matches (default)
- "content": Matching lines with file:line:content format
- "count": Count of matches per file`
          ),
      }),
    }
  );

  return createMiddleware({
    name: "filesystemFileSearchMiddleware",
    tools: [globSearch, grepSearch],
  });
}
