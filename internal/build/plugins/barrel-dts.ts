import fs from "node:fs";
import { resolve, dirname } from "node:path";

import type { Plugin, PluginContext, OutputOptions } from "rolldown";
import type { PackageJson } from "type-fest";

export interface BarrelDtsPluginOptions {
  /**
   * Whether to enable barrel .d.ts generation
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to update package.json files field with generated barrel files
   * @default true
   */
  updatePackageJson?: boolean;

  /**
   * Additional files to add to package.json files array
   * @default []
   */
  additionalFiles?: string[];
}

/**
 * Rolldown plugin for generating barrel .d.ts files at package root.
 *
 * ## What is this plugin for?
 *
 * When using CommonJS with TypeScript (`"module": "commonjs"` in tsconfig.json),
 * TypeScript has a limitation in how it resolves types for named exports from packages.
 * Even though package.json exports include a `types` field pointing to the correct
 * .d.ts location in the dist folder, TypeScript's CommonJS resolution still looks for
 * .d.ts files at the package root level for paths like `@langchain/core/prompts`.
 *
 * This means:
 * - Runtime: `require("@langchain/core/prompts")` works correctly ✅
 * - Types: TypeScript looks for `prompts.d.ts` at package root ❌
 *
 * ## What this plugin does:
 *
 * 1. **Discovers** all entrypoints from package.json exports field
 * 2. **Extracts** the dist path from the CommonJS types field in exports
 * 3. **Generates** barrel .d.ts files at the package root that re-export from dist
 * 4. **Handles** nested paths correctly (e.g., `callbacks/base.d.ts`)
 * 5. **Cleans up** stale barrel files from previous builds
 *
 * ## Example:
 *
 * For an export like:
 * ```json
 * {
 *   "./prompts": {
 *     "require": {
 *       "types": "./dist/prompts/index.d.cts",
 *       "default": "./dist/prompts/index.cjs"
 *     }
 *   }
 * }
 * ```
 *
 * This plugin generates `prompts.d.ts` at package root:
 * ```typescript
 * export * from "./dist/prompts/index.d.cts";
 * ```
 */
export function barrelDtsPlugin(options: BarrelDtsPluginOptions = {}): Plugin {
  const opts = {
    enabled: true,
    updatePackageJson: true,
    additionalFiles: [],
    ...options,
  };

  return {
    name: "barrel-dts",

    async buildEnd(this: PluginContext) {
      // @ts-expect-error - outputOptions is available in rolldown plugin context but not typed
      const outputOptions = this.outputOptions as OutputOptions;

      /**
       * only run plugin if:
       * - enabled is true
       * - outputOptions.format is cjs so we only run during CommonJS build
       */
      const format = outputOptions.format;
      const isCjsBuild =
        format === "cjs" || (Array.isArray(format) && format.includes("cjs"));

      if (!opts.enabled || !isCjsBuild) {
        return;
      }

      try {
        // Read package.json from current working directory
        const packagePath = process.cwd();
        const packageJsonPath = resolve(packagePath, "package.json");
        const packageInfo = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8")
        ) as PackageJson;

        // Get entrypoints from package.json exports
        const barrelFiles = extractBarrelFilesFromExports(packageInfo.exports);

        if (Object.keys(barrelFiles).length > 0) {
          console.log(
            `📦 Generating ${
              Object.keys(barrelFiles).length
            } barrel .d.ts files for CommonJS type resolution`
          );
          await generateBarrelFiles(packagePath, barrelFiles);
          console.log(`✅ Generated barrel .d.ts files`);

          // Update package.json files field if enabled
          if (opts.updatePackageJson) {
            await updatePackageJsonFiles(
              packagePath,
              packageInfo,
              barrelFiles,
              opts.additionalFiles!
            );
            console.log(`📝 Updated package.json files field`);
          }
        }
      } catch (error) {
        console.warn("⚠️ Barrel .d.ts generation failed:", error);
      }
    },
  };
}

/**
 * Extract barrel file mappings from package.json exports field
 * Returns a map of barrel file path -> dist type file path
 */
function extractBarrelFilesFromExports(
  exports: PackageJson["exports"]
): Record<string, string> {
  if (!exports) return {};

  const barrelFiles: Record<string, string> = {};

  for (const [key, value] of Object.entries(exports)) {
    // Skip package.json and root export
    if (key === "./package.json" || key === ".") continue;

    // Normalize the key to get the barrel file path
    const barrelPath = key.replace("./", "");

    if (typeof value === "object" && value && "require" in value) {
      const requireCondition = value.require;
      if (
        typeof requireCondition === "object" &&
        requireCondition &&
        "types" in requireCondition
      ) {
        // Extract the types path from the require condition
        const typesPath = requireCondition.types as string;
        // Remove leading ./ if present
        const cleanTypesPath = typesPath.replace(/^\.\//, "");

        barrelFiles[barrelPath] = cleanTypesPath;
      }
    }
  }

  return barrelFiles;
}

/**
 * Generate barrel .d.ts files at package root
 */
async function generateBarrelFiles(
  packagePath: string,
  barrelFiles: Record<string, string>
): Promise<void> {
  for (const [barrelPath, typesPath] of Object.entries(barrelFiles)) {
    const barrelFilePath = resolve(packagePath, `${barrelPath}.d.ts`);

    // Ensure parent directory exists
    const parentDir = dirname(barrelFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Calculate relative path from barrel file to the dist types file (without extension)
    const relativePath = calculateRelativePath(barrelPath, typesPath);

    // Generate the barrel file content
    const content = `export * from "${relativePath}";`;

    // Write the file
    fs.writeFileSync(barrelFilePath, content, "utf-8");
  }
}

/**
 * Calculate the relative path from barrel file location to the dist types file
 * Returns path without file extension for proper TypeScript module resolution
 */
function calculateRelativePath(barrelPath: string, typesPath: string): string {
  const barrelDepth = barrelPath.split("/").length - 1;

  // Build the relative path with appropriate ../
  const upLevels = barrelDepth > 0 ? "../".repeat(barrelDepth) : "./";

  // Remove the leading ./ and file extension from typesPath
  const cleanPath = typesPath
    .replace(/^\.\//, "")
    .replace(/\.d\.cts$/, "")
    .replace(/\.d\.ts$/, "")
    .replace(/\.cts$/, "")
    .replace(/\.ts$/, "")
    .replace(/\.js$/, "");

  return `${upLevels}${cleanPath}`;
}

/**
 * Update package.json files field to include barrel files and additional files
 */
async function updatePackageJsonFiles(
  packagePath: string,
  packageInfo: PackageJson,
  barrelFiles: Record<string, string>,
  additionalFiles: string[]
): Promise<void> {
  const packageJsonPath = resolve(packagePath, "package.json");

  // Get existing files array or create new one
  const existingFiles = (packageInfo.files as string[]) || [];

  // Generate list of barrel file paths
  const barrelFilePaths = Object.keys(barrelFiles).map(
    (barrelPath) => `${barrelPath}.d.ts`
  );

  // Combine existing files, barrel files, and additional files
  // Use a Set to avoid duplicates
  const allFiles = [
    ...new Set([...existingFiles, ...barrelFilePaths, ...additionalFiles]),
  ];

  // Update package.json
  const updatedPackageInfo = {
    ...packageInfo,
    files: allFiles,
  };

  // Write back to package.json with formatting
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(updatedPackageInfo, null, 2) + "\n",
    "utf-8"
  );
}
