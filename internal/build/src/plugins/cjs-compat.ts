import path from "node:path";
import fs from "node:fs/promises";
import type { Plugin } from "rolldown";
import { isSafeProjectPath, toPosixPath } from "../utils.ts";

/**
 * Options for configuring the CJS compatibility plugin.
 */
export interface CjsCompatPluginOptions {
  /**
   * Whether the plugin is enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * The mode of operation for the plugin.
   * - "generate": Creates barrel files for CJS compatibility
   * - "clean": Removes generated barrel files
   * @default "generate" when BUILD_MODE is "prerelease", otherwise "clean"
   */
  mode?: "generate" | "clean";
  /**
   * Specifies which types of files should be generated or cleaned.
   */
  shouldGenerate?: {
    /**
     * Whether to generate/clean .d.cts files.
     * @default true
     */
    dcts?: boolean;
    /**
     * Whether to generate/clean .cjs files.
     * @default true
     */
    cjs?: boolean;
    /**
     * Whether to generate/clean .d.ts files.
     * @default true
     */
    dts?: boolean;
    /**
     * Whether to generate/clean .js (ESM) files.
     * @default true
     */
    esm?: boolean;
  };
  /**
   * Specifies which files should be included in the package.json `files` array.
   *
   * Because this plugin generates files in the root directory, it's important
   * to specify which files should be included in the `files` array. In the case
   * you need to include extra files in the npm bundle, you can specify them here.
   */
  files?: string[];
}

/**
 * Creates a Rolldown plugin that generates barrel files for CommonJS compatibility.
 *
 * This plugin creates re-export barrel files for each entrypoint to ensure proper
 * module resolution in both CommonJS and ESM environments. It generates .cjs, .d.cts,
 * .d.ts, and .js files that re-export from the compiled dist directory.
 *
 * @param param - Configuration options for the plugin
 * @returns A Rolldown plugin instance
 *
 * @example
 * ```ts
 * export default getBuildConfig({
 *   entry: ["./src/index.ts"],
 *   plugins: [cjsCompatPlugin()],
 * });
 * ```
 */
export function cjsCompatPlugin(param: CjsCompatPluginOptions = {}): Plugin {
  const defaultBuildMode =
    process.env.BUILD_MODE === "prerelease" ? "generate" : "clean";
  const options = {
    enabled: true,
    mode: defaultBuildMode,
    ...param,
    shouldGenerate: {
      dcts: true,
      cjs: true,
      dts: true,
      esm: true,
      ...param.shouldGenerate,
    },
  };

  const pathsToEmit = new Set<string>();

  return {
    name: "cjs-compat",
    async buildStart({ input }) {
      if (!options.enabled) return;

      // Get relative path of the entrypoint from src directory
      for (const entrypointPath of Object.values(input)) {
        // Normalize to forward slashes for cross-platform compatibility.
        // On Windows, path.relative and path.join produce backslash paths
        // which break split("/") operations and import path generation.
        const relativePath = toPosixPath(
          path.relative(
            path.join(process.env.INIT_CWD ?? "", "src"),
            entrypointPath
          )
        );

        // Get the target path for the barrel file (e.g. callbacks/base/index)
        const barrelTarget = path.posix.join(
          path.posix.dirname(relativePath),
          path.posix.basename(relativePath, path.posix.extname(relativePath))
        );
        // Get the path for the barrel file (e.g. callbacks/base)
        const barrelPath =
          path.posix.basename(barrelTarget) === "index"
            ? path.posix.dirname(barrelTarget)
            : barrelTarget;
        // Get the depth of the barrel file (e.g. 1 for callbacks/base/index)
        const barrelDepth = barrelPath.split("/").length - 1;
        // Get the import path for the barrel file (e.g. ../dist/callbacks/base/index.cjs)
        const importPath =
          barrelDepth === 0
            ? `./dist/${barrelTarget}`
            : `${"../".repeat(barrelDepth)}dist/${barrelTarget}`;

        // Skip the root barrel file
        if (barrelPath === ".") {
          continue;
        }

        const emitFile = async (fileName: string, source: string) => {
          const topLevelPath = fileName.split("/")[0];
          pathsToEmit.add(topLevelPath);
          if (options.mode === "generate") {
            const target = path.resolve(`./${fileName}`);
            if (isSafeProjectPath(target)) {
              await fs
                .mkdir(path.dirname(target), { recursive: true })
                .catch(() => {});
              await fs.writeFile(target, source);
            }
          }
          if (options.mode === "clean") {
            const target = path.resolve(`./${fileName}`);
            if (isSafeProjectPath(target)) {
              await fs.unlink(target).catch(() => {});
            }
          }
        };

        if (options.shouldGenerate.dcts) {
          await emitFile(`${barrelPath}.d.cts`, generateDctsBarrel(importPath));
        }
        if (options.shouldGenerate.cjs) {
          await emitFile(`${barrelPath}.cjs`, generateCjsBarrel(importPath));
        }
        if (options.shouldGenerate.dts) {
          await emitFile(`${barrelPath}.d.ts`, generateDtsBarrel(importPath));
        }
        if (options.shouldGenerate.esm) {
          await emitFile(`${barrelPath}.js`, generateEsmBarrel(importPath));
        }

        if (options.mode === "clean") {
          // Remove any directories that were created for nested entrypoints
          const dirPath = path.posix.dirname(barrelPath);
          if (dirPath !== ".") {
            const target = path.resolve(dirPath);
            if (isSafeProjectPath(target)) {
              await fs.rm(target, { recursive: true }).catch(() => {});
            }
          }
        }
      }
    },
    buildEnd: {
      async handler() {
        if (!options.enabled) return;

        const packageJsonPath = path.resolve(
          process.env.INIT_CWD ?? "",
          "package.json"
        );
        if (isSafeProjectPath(packageJsonPath)) {
          const packageJson = JSON.parse(
            await fs.readFile(packageJsonPath, "utf-8")
          );
          packageJson.files = [
            ...(options.files ?? []),
            ...Array.from(pathsToEmit),
          ];
          await fs.writeFile(
            packageJsonPath,
            /**
             * set new line at the end of the file
             * see .editorconfig
             */
            `${JSON.stringify(packageJson, null, 2)}\n`
          );
        }
      },
      order: "post",
    },
  };
}

function generateCjsBarrel(importPath: string) {
  return `module.exports = require("${importPath}.cjs");`;
}
function generateDctsBarrel(importPath: string) {
  return `export * from "${importPath}.js";`;
}
function generateEsmBarrel(importPath: string) {
  return `export * from "${importPath}.js";`;
}
function generateDtsBarrel(importPath: string) {
  return `export * from "${importPath}.js";`;
}
