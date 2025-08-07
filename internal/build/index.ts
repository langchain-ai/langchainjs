import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

import { build, type Format, type AttwOptions } from "tsdown";
import type { PackageJson } from "type-fest";
import type { Options as UnusedOptions } from "unplugin-unused";

import { lcSecretsPlugin } from "./plugins/lc-secrets.js";
import { importConstantsPlugin } from "./plugins/import-constants.js";
import { importMapPlugin } from "./plugins/import-map.js";
import { findWorkspacePackages } from "./utils.js";
import {
  extraImportMapEntries,
  optionalEntrypoints,
  deprecatedOmitFromImportMap,
} from "./constants.js";
import type { CompilePackageOptions } from "./types.js";

const __dirname = fileURLToPath(import.meta.url);
const root = resolve(__dirname, "..", "..", "..");

export async function compilePackages(opts: CompilePackageOptions) {
  const packages = await findWorkspacePackages(root, opts);
  if (packages.length === 0) {
    const query = opts.packageQuery
      ? `matching "${opts.packageQuery}"`
      : "with no package query";
    throw new Error(`No packages found ${query}!`);
  }

  await Promise.all(
    packages.map(({ pkg, path }) => buildProject(path, pkg, opts))
  );
}

async function buildProject(
  path: string,
  pkg: PackageJson,
  opts: CompilePackageOptions
) {
  const input = Object.entries(pkg.exports || {}).filter(
    ([exp]) => !extname(exp)
  ) as [string, PackageJson.ExportConditions][];
  const entry = input.map(([, { input }]) => input).filter(Boolean) as string[];
  const watch = opts.watch ?? false;
  const sourcemap = !opts.skipSourcemap;
  const exportsCJS = Object.values(pkg.exports || {}).some(
    (exp) => typeof exp === "object" && exp && "require" in exp
  );
  const format: Format[] = exportsCJS ? ["esm", "cjs"] : ["esm"];

  /**
   * don't clean if user passes `--skipClean` or if `--noEmit` is enabled
   * as we don't want to clean previous builds if we're not emitting anything
   */
  const clean = !opts.skipClean && !opts.noEmit;

  /**
   * generate type declarations if not disabled
   */
  const dts = !opts.noEmit
    ? {
        parallel: true,
        cwd: path,
        sourcemap,
        tsgo: true,
      }
    : false;

  /**
   * if there are no entrypoints, skip the package
   */
  if (entry.length === 0) {
    return;
  }

  /**
   * build checks to run, automatically disabled if watch is enabled
   */
  const buildChecks = {
    unused:
      !watch && !opts.skipUnused && false
        ? ({
            root: path,
            level: "error" as const,
          } as UnusedOptions)
        : false,
    attw: {
      profile: exportsCJS ? "node16" : "esmOnly",
      level: "error",
    } as AttwOptions,
    /**
     * skip publint if:
     * - watch is enabled, to avoid running publint on every change
     * - noEmit is enabled, as not emitting types fails this check
     */
    publint:
      !watch && !opts.noEmit
        ? ({
            pkgDir: path,
            level: "error" as const,
            strict: true,
          } as const)
        : false,
  };

  /**
   * plugins to run, automatically disabled if watch is enabled
   */
  const plugins = !watch
    ? [
        lcSecretsPlugin({
          // Enable/disable based on environment
          enabled: process.env.SKIP_SECRET_SCANNING !== "true",
          // Use lenient validation in development
          strict: process.env.NODE_ENV === "production",
          // package path for the secret map
          packagePath: path,
        }),
        importConstantsPlugin({
          // Enable/disable based on environment
          enabled: process.env.SKIP_IMPORT_CONSTANTS !== "true",
          // package path for reading package.json
          packagePath: path,
          // package info for reading package.json
          packageInfo: pkg,
          // Add optional entrypoints for langchain package
          optionalEntrypoints: optionalEntrypoints[pkg.name!] || [],
        }),
        importMapPlugin({
          // Enable/disable based on environment
          enabled: process.env.SKIP_IMPORT_MAP !== "true",
          // package path for the import map
          packagePath: path,
          // package info for reading entrypoints
          packageInfo: pkg,
          // Add extra import map entries for langchain package
          extraImportMapEntries: extraImportMapEntries[pkg.name!] || [],
          // Exclude deprecated entrypoints from import map
          // or imports that would cause circular dependencies
          deprecatedOmitFromImportMap:
            deprecatedOmitFromImportMap[pkg.name!] || [],
        }),
      ]
    : [];

  await build({
    entry,
    clean,
    cwd: path,
    dts,
    sourcemap,
    unbundle: true,
    platform: "node",
    target: "es2022",
    outDir: "./dist",
    format,
    watch,
    tsconfig: resolve(path, "tsconfig.json"),
    ignoreWatch: [
      `${path}/.turbo`,
      `${path}/dist`,
      `${path}/node_modules`,
      /**
       * ignore files that are generated by the plugins
       */
      `${path}/src/load/import_constants.ts`,
      `${path}/src/load/import_map.ts`,
      `${path}/src/load/import_type.ts`,
    ],
    inputOptions: {
      cwd: path,
    },
    plugins,
    ...buildChecks,
  });
}
