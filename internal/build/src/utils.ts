import path from "node:path";
import prettier from "prettier";

export const PROJECT_ROOT = process.cwd();

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
