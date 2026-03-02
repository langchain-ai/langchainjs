import path from "node:path";
import prettier from "prettier";

export const PROJECT_ROOT = process.cwd();

/**
 * Converts a file path to use POSIX-style forward slashes.
 *
 * This is important for package.json exports, import maps, and other
 * contexts where paths must use forward slashes regardless of the OS.
 * On Windows, Node's `path.join`, `path.dirname`, etc. produce
 * backslash-separated paths which break package tooling like publint.
 *
 * @param p - The file path to normalize
 * @returns The path with all backslashes replaced by forward slashes
 */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function isSafeProjectPath(targetPath: string): boolean {
  // Normalize and check for containment in root
  const resolvedRoot = path.resolve(PROJECT_ROOT);
  const resolvedPath = path.resolve(targetPath);
  return resolvedPath.startsWith(resolvedRoot + path.sep);
}

export async function formatWithPrettier(source: string) {
  // Get prettier config for the file
  const prettierConfig = await prettier.resolveConfig(PROJECT_ROOT);
  // Format the code with TypeScript parser
  const formatted = await prettier.format(source, {
    ...prettierConfig,
    parser: "typescript",
  });
  return formatted;
}
