import fs from "node:fs";
import { resolve } from "node:path";

import type { Plugin, PluginContext, OutputOptions } from "rolldown";
import type { PackageJson } from "type-fest";

interface ImportConstantsPluginOptions {
  /**
   * Whether to enable import constants generation
   * @default true
   */
  enabled?: boolean;

  /**
   * Path for the generated import constants file relative to package src directory
   * @default "load/import_constants.ts"
   */
  outputPath?: string;

  /**
   * Path to the package
   */
  packagePath: string;

  /**
   * Package path to read package.json from
   */
  packageInfo: PackageJson;

  /**
   * List of entrypoints that require optional dependencies
   * If not provided, will try to detect from package.json peerDependenciesMeta
   */
  optionalEntrypoints?: string[];

  /**
   * List of entrypoints that are deprecated and node-only
   */
  deprecatedNodeOnly?: string[];
}

/**
 * Rolldown plugin for generating import constants for entrypoints that require optional dependencies.
 *
 * ## What are import constants?
 *
 * Import constants are generated lists of entrypoint names that require optional dependencies.
 * These are used by LangChain's dynamic import system to conditionally load modules only
 * when their dependencies are available.
 *
 * For example, if a package has entrypoints for different AI providers, some might require
 * optional dependencies that users may not have installed. The import constants help the
 * runtime determine which modules can be safely imported.
 *
 * ## What this plugin does:
 *
 * 1. **Discovers** all entrypoints from package.json exports field
 * 2. **Filters** to only include entrypoints that require optional dependencies
 * 3. **Excludes** deprecated node-only entrypoints
 * 4. **Generates** a TypeScript file with an array of optional import entrypoints
 * 5. **Updates** the file only when entrypoints change to avoid unnecessary rebuilds
 */
export function importConstantsPlugin(
  options: ImportConstantsPluginOptions
): Plugin {
  const opts = {
    enabled: true,
    outputPath: "load/import_constants.ts",
    deprecatedNodeOnly: [],
    ...options,
  } as Required<ImportConstantsPluginOptions>;

  return {
    name: "import-constants",

    buildStart(this: PluginContext) {
      // @ts-expect-error - outputOptions is available in rolldown plugin context but not typed
      const outputOptions = this.outputOptions as OutputOptions;

      /**
       * only run plugin if:
       * - enabled is true
       * - outputOptions.format is es so we only run during ESM build
       */
      if (!opts.enabled || outputOptions.format !== "es") {
        return;
      }

      try {
        // Generate import constants
        const optionalEntrypoints = getOptionalEntrypoints(
          opts.packageInfo,
          opts
        );
        if (optionalEntrypoints.length > 0) {
          console.log(
            `📋 Found ${optionalEntrypoints.length} optional entrypoints`
          );
          generateImportConstants(opts.packagePath, optionalEntrypoints, opts);
        }
      } catch (error) {
        console.warn("⚠️ Import constants generation failed:", error);
      }
    },
  };
}

/**
 * Get list of entrypoints that require optional dependencies
 */
function getOptionalEntrypoints(
  packageInfo: { name?: string; exports?: PackageJson["exports"] },
  opts: ImportConstantsPluginOptions
): string[] {
  if (!packageInfo.exports) {
    return [];
  }

  // If explicitly provided, use those
  if (opts.optionalEntrypoints) {
    return opts.optionalEntrypoints.filter(
      (entrypoint) => !opts.deprecatedNodeOnly?.includes(entrypoint)
    );
  }

  // Extract entrypoints from exports field
  // const entrypoints = Object.keys(packageInfo.exports)
  //     .filter(key => key !== './package.json') // Exclude package.json export
  //     .map(key => key === '.' ? 'index' : key.replace('./', '')) // Normalize keys
  //     .filter(key => !opts.deprecatedNodeOnly?.includes(key));

  // For now, return empty array since we don't have a way to automatically detect
  // which entrypoints require optional dependencies without additional configuration
  // In practice, this would need to be configured per package or detected from
  // the actual source files
  return [];
}

/**
 * Generate the import constants TypeScript file
 */
function generateImportConstants(
  packagePath: string,
  optionalEntrypoints: string[],
  opts: Required<ImportConstantsPluginOptions>
): void {
  const packageSuffix = opts.packageInfo.name!.split("/")[1] || "";
  const outputPath = resolve(packagePath, "src", opts.outputPath);

  // Ensure directory exists
  fs.mkdirSync(resolve(packagePath, "src", "load"), { recursive: true });

  // Create import statements
  const createImportStatement = (entrypoint: string) =>
    `  "langchain${packageSuffix ? `_${packageSuffix}` : ""}/${entrypoint}"`;

  const contents =
    optionalEntrypoints.length > 0
      ? `\n${optionalEntrypoints.map(createImportStatement).join(",\n")},\n];\n`
      : "];\n";

  const fileContent = `// Auto-generated by import-constants plugin. Do not edit manually.

export const optionalImportEntrypoints: string[] = [${contents}`;

  // Only write if content has changed to avoid unnecessary rebuilds
  let shouldWrite = true;
  try {
    const existingContent = fs.readFileSync(outputPath, "utf-8");
    shouldWrite = existingContent !== fileContent;
  } catch {
    // File doesn't exist, so we should write it
  }

  if (shouldWrite) {
    fs.writeFileSync(outputPath, fileContent);
    console.log(`📝 Generated import constants: ${opts.outputPath}`);
  }
}
