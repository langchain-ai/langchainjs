import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import prettier from "prettier";
import type { PackageJson } from "type-fest";

import type { CompilePackageOptions } from "./types.js";

const execAsync = promisify(exec);

interface PnpmWorkspace {
  name: string;
  version?: string;
  path: string;
  private?: boolean;
}

export interface WorkspacePackage {
  pkg: PackageJson;
  path: string;
}

/**
 * Find all packages in the pnpm workspace that match the package query and are not excluded.
 *
 * @param rootDir - The root directory of the workspace
 * @param opts - Options for filtering packages including packageQuery and exclude patterns
 * @returns A list of packages that match the query and are not excluded.
 */
export async function findWorkspacePackages(
  rootDir: string,
  opts: CompilePackageOptions
) {
  const result = await execAsync("pnpm list --recursive --depth=-1 --json");
  const workspacesArray: PnpmWorkspace[] = JSON.parse(result.stdout);
  const workspaces = (
    await Promise.all(
      workspacesArray.map(async (workspace: PnpmWorkspace) => {
        try {
          // Skip the root workspace (it has the same path as rootDir)
          if (workspace.path === rootDir) {
            return null;
          }
          const pkgPath = resolve(workspace.path, "package.json");
          const pkg = JSON.parse(
            await readFile(pkgPath, "utf-8")
          ) as PackageJson;

          /**
           * skip package if it matches any exclude pattern
           */
          if (opts.exclude && opts.exclude.length > 0) {
            const isExcluded = opts.exclude.some(
              (excludePattern) => pkg.name === excludePattern
            );
            if (isExcluded) {
              return null;
            }
          }

          /**
           * compile package if no query is provided or the package name matches the query
           */
          if (
            !opts.packageQuery ||
            opts.packageQuery.length === 0 ||
            (pkg.name && opts.packageQuery.includes(pkg.name))
          ) {
            return {
              pkg,
              path: workspace.path,
            };
          }

          return null;
        } catch (error) {
          console.error(
            `Error loading package.json for package: ${workspace.name}`,
            error
          );
          /* ignore */
          return null;
        }
      })
    )
  ).filter(Boolean) as WorkspacePackage[];
  return workspaces;
}

/**
 * Format TypeScript code using prettier with the project's configuration
 *
 * @param code - The TypeScript code to format
 * @param filePath - The file path for context (used to find prettier config)
 * @returns The formatted code
 */
export async function formatWithPrettier(
  code: string,
  filePath: string
): Promise<string> {
  try {
    // Get prettier config for the file
    const prettierConfig = await prettier.resolveConfig(filePath);

    // Format the code with TypeScript parser
    const formatted = await prettier.format(code, {
      ...prettierConfig,
      parser: "typescript",
    });

    return formatted;
  } catch (error) {
    console.warn("⚠️ Failed to format code with prettier:", error);
    // Return the original code if formatting fails
    return code;
  }
}
