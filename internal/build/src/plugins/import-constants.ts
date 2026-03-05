import path from "node:path";
import type { Plugin } from "rolldown";
import type { PackageJson } from "type-fest";
import { formatWithPrettier } from "../utils.ts";
import { pathToFileURL } from "node:url";

/**
 * Configuration options for the import constants plugin.
 *
 * This plugin generates a TypeScript file containing an array of optional import entrypoints
 * for a LangChain package. These entrypoints typically represent modules that have optional
 * dependencies or are not required for core functionality.
 */
export interface ImportConstantsPluginOptions {
  /**
   * Whether the plugin is enabled.
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * The output path for the generated import constants file, relative to the package root.
   *
   * The file will contain an exported array of entrypoint strings that can be used
   * for dynamic imports or dependency checking.
   *
   * @default "src/load/import_constants.ts"
   *
   * @example
   * ```ts
   * outputPath: "src/load/import_constants.ts"
   * ```
   */
  outputPath?: string;

  /**
   * An array of entrypoint paths to include in the generated constants file.
   *
   * Each entrypoint should be a relative path from the package root (without the package name prefix).
   * The plugin will automatically prepend the appropriate package name prefix when generating
   * the import statements.
   *
   * @example
   * ```ts
   * entrypoints: ["tools/calculator", "embeddings/openai", "llms/anthropic"]
   * // Generates:
   * // "langchain_community/tools/calculator"
   * // "langchain_community/embeddings/openai"
   * // "langchain_community/llms/anthropic"
   * ```
   */
  entrypoints?: string[];
}

/**
 * Rolldown plugin that generates a TypeScript file containing import constants for optional entrypoints.
 *
 * This plugin is designed for LangChain packages to automatically generate a list of optional
 * import entrypoints that may have external dependencies or are not part of the core package.
 * The generated file can be used at runtime to check which imports are available or to
 * dynamically load optional modules.
 *
 * ## How it works
 *
 * 1. During the `buildStart` hook, the plugin reads the package.json to determine the package name
 * 2. It creates the output directory if it doesn't exist
 * 3. It generates import statement strings for each configured entrypoint
 * 4. It writes a TypeScript file with an exported array of these import paths
 *
 * ## Generated file format
 *
 * The generated file exports a single constant array:
 *
 * ```ts
 * export const optionalImportEntrypoints: string[] = [
 *   "langchain_community/tools/calculator",
 *   "langchain_community/embeddings/openai",
 *   // ... more entrypoints
 * ];
 * ```
 *
 * ## Package name handling
 *
 * The plugin automatically handles package naming:
 * - For `@langchain/core`: generates `langchain/...` imports
 * - For `@langchain/community`: generates `langchain_community/...` imports
 * - For `@langchain/openai`: generates `langchain_openai/...` imports
 *
 * @param param - Configuration options for the plugin
 * @returns A Rolldown plugin instance
 *
 * @example
 * Basic usage in rolldown.config.ts:
 * ```ts
 * import { importConstantsPlugin } from "./build/plugins/import-constants";
 *
 * export default {
 *   plugins: [
 *     importConstantsPlugin({
 *       entrypoints: [
 *         "tools/calculator",
 *         "embeddings/openai",
 *         "llms/anthropic"
 *       ]
 *     })
 *   ]
 * };
 * ```
 *
 * @example
 * Custom output path:
 * ```ts
 * importConstantsPlugin({
 *   outputPath: "src/generated/imports.ts",
 *   entrypoints: ["tools/calculator"]
 * })
 * ```
 *
 * @example
 * Disabling the plugin:
 * ```ts
 * importConstantsPlugin({
 *   enabled: false,
 *   entrypoints: []
 * })
 * ```
 */
export function importConstantsPlugin(
  param: ImportConstantsPluginOptions = {}
): Plugin {
  const options = {
    enabled: true,
    outputPath: "src/load/import_constants.ts",
    entrypoints: [],
    ...param,
  } as Required<ImportConstantsPluginOptions>;

  const packageJsonPath = path.resolve(
    process.env.INIT_CWD ?? "",
    "./package.json"
  );
  const outputPath = path.resolve(
    process.env.INIT_CWD ?? "",
    options.outputPath
  );

  return {
    name: "import-constants",
    async buildStart() {
      if (!options.enabled) return;

      const packageJsonModule = await import(
        pathToFileURL(packageJsonPath).href,
        {
          with: { type: "json" },
        }
      );
      const packageJson: PackageJson = packageJsonModule.default;
      const packageName = packageJson.name ?? "";
      // Handle both scoped (@langchain/core) and unscoped (langchain) packages
      const packageSuffix = packageName.startsWith("@langchain/")
        ? packageName.replace("@langchain/", "")
        : packageName === "langchain"
          ? ""
          : packageName;
      await this.fs.mkdir(path.dirname(outputPath), { recursive: true });

      const createImportStatement = (entrypoint: string) =>
        `  "langchain${packageSuffix ? `_${packageSuffix}` : ""}/${entrypoint}",`;

      const lines = [
        `/** Auto-generated by import-constants plugin. Do not edit manually */`,
        ``,
        `export const optionalImportEntrypoints: string[] = [`,
        ...options.entrypoints.map(createImportStatement),
        `];`,
      ];

      await this.fs.writeFile(
        outputPath,
        await formatWithPrettier(lines.join("\n"))
      );
      this.info(`📝 Generated import constants file: ${outputPath}`);
    },
  };
}
