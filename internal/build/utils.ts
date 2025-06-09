import { resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { PackageJson } from "type-fest";

import type { CompilePackageOptions } from "./types.js";

const execAsync = promisify(exec);

export interface WorkspacePackage {
  pkg: PackageJson;
  path: string;
}

/**
 * Find all packages in the workspace that match the package query and are not excluded.
 *
 * @param rootDir - The root directory of the workspace
 * @param packageQuery - Optional query to filter packages
 * @param exclude - Optional array of package names or patterns to exclude
 * @returns A list of packages that match the query and are not excluded.
 */
export async function findWorkspacePackages(
  rootDir: string,
  opts: CompilePackageOptions
) {
  const result = await execAsync("yarn workspaces list --json");
  const workspaces = (
    await Promise.all(
      result.stdout.split("\n").map(async (line) => {
        try {
          const workspace = JSON.parse(line);
          if (workspace.location === ".") {
            return null;
          }
          const pkg = await import(
            resolve(rootDir, workspace.location, "package.json")
          );

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
            opts.packageQuery.includes(pkg.name)
          ) {
            return {
              pkg,
              path: resolve(rootDir, workspace.location),
            };
          }
        } catch {
          /* ignore */
        }
      })
    )
  ).filter(Boolean) as WorkspacePackage[];
  return workspaces;
}
