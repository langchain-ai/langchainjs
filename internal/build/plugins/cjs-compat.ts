import path from "node:path";
import fs from "node:fs/promises";
import type { Plugin } from "rolldown";
import { isSafeProjectPath } from "../utils";

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

  return {
    name: "cjs-compat",
    async buildStart({ input }) {
      if (!options.enabled) return;

      // Get relative path of the entrypoint from src directory
      for (const entrypointPath of Object.values(input)) {
        const relativePath = path.relative(
          path.join(process.env.INIT_CWD ?? "", "src"),
          entrypointPath
        );

        // Get the target path for the barrel file (e.g. callbacks/base/index)
        const barrelTarget = path.join(
          path.dirname(relativePath),
          path.basename(relativePath, path.extname(relativePath))
        );
        // Get the path for the barrel file (e.g. callbacks/base)
        const barrelPath =
          path.basename(barrelTarget) === "index"
            ? path.dirname(barrelTarget)
            : barrelTarget;
        // Get the depth of the barrel file (e.g. 1 for callbacks/base/index)
        const barrelDepth = barrelPath.split("/").length - 1;
        // Get the import path for the barrel file (e.g. ../dist/callbacks/base/index.cjs)
        const importPath =
          barrelDepth === 0
            ? `./dist/${barrelTarget}`
            : "../".repeat(barrelDepth) + `dist/${barrelTarget}`;

        // Skip the root barrel file
        if (barrelPath === ".") {
          continue;
        }

        if (options.mode === "generate") {
          if (options.shouldGenerate.dcts) {
            this.emitFile({
              type: "asset",
              fileName: `../${barrelPath}.d.cts`,
              source: generateDctsBarrel(importPath),
            });
          }
          if (options.shouldGenerate.cjs) {
            this.emitFile({
              type: "asset",
              fileName: `../${barrelPath}.cjs`,
              source: generateCjsBarrel(importPath),
            });
          }
          if (options.shouldGenerate.dts) {
            this.emitFile({
              type: "asset",
              fileName: `../${barrelPath}.d.ts`,
              source: generateDtsBarrel(importPath),
            });
          }
          if (options.shouldGenerate.esm) {
            this.emitFile({
              type: "asset",
              fileName: `../${barrelPath}.js`,
              source: generateEsmBarrel(importPath),
            });
          }
        }

        if (options.mode === "clean") {
          if (options.shouldGenerate.dcts) {
            const target = path.resolve(`./${barrelPath}.d.cts`);
            if (isSafeProjectPath(target)) {
              await fs.unlink(target).catch(() => {});
            }
          }
          if (options.shouldGenerate.cjs) {
            const target = path.resolve(`./${barrelPath}.cjs`);
            if (isSafeProjectPath(target)) {
              await fs.unlink(target).catch(() => {});
            }
          }
          if (options.shouldGenerate.dts) {
            const target = path.resolve(`./${barrelPath}.d.ts`);
            if (isSafeProjectPath(target)) {
              await fs.unlink(target).catch(() => {});
            }
          }
          if (options.shouldGenerate.esm) {
            const target = path.resolve(`./${barrelPath}.js`);
            if (isSafeProjectPath(target)) {
              await fs.unlink(target).catch(() => {});
            }
          }

          // Remove any directories that were created for nested entrypoints
          const dirPath = path.dirname(barrelPath);
          if (dirPath !== ".") {
            const target = path.resolve(dirPath);
            if (isSafeProjectPath(target)) {
              await fs.rmdir(target, { recursive: true }).catch(() => {});
            }
          }
        }
      }
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
