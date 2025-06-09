import fs from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'rolldown';
import type { PackageJson } from 'type-fest';

interface ExtraImportMapEntry {
    modules: Array<string>;
    alias: Array<string>;
    path: string;
}

interface ImportData {
    imports: Record<string, string[]>;
    exportedAliases: Record<string, string[]>;
}

interface ImportMapPluginOptions {
    /**
     * Whether to enable import map generation
     * @default true
     */
    enabled?: boolean;

    /**
     * Path for the generated import map file relative to package src directory
     * @default "load/import_map.ts"
     */
    outputPath?: string;

    /**
     * Path to the package
     */
    packagePath: string;

    /**
     * Package info for reading entrypoints
     */
    packageInfo: PackageJson;

    /**
     * List of entrypoints that are deprecated and node-only
     */
    deprecatedNodeOnly?: string[];

    /**
     * List of entrypoints that require optional dependencies
     */
    requiresOptionalDependency?: string[];

    /**
     * List of entrypoints that are deprecated and should be omitted from import map
     */
    deprecatedOmitFromImportMap?: string[];

    /**
     * Extra entries to add to the import map
     */
    extraImportMapEntries?: Array<ExtraImportMapEntry>;
}

/**
 * Rolldown plugin for generating import maps from package entrypoints.
 * 
 * ## What are import maps?
 * 
 * Import maps are generated files that re-export all entrypoints from a package
 * in a single file. This allows for convenient bulk imports and provides a 
 * centralized way to access all package functionality.
 * 
 * For example, instead of importing from multiple files:
 * ```typescript
 * import { OpenAI } from '@langchain/openai';
 * import { ChatAnthropic } from '@langchain/anthropic';
 * ```
 * 
 * You can import from the import map:
 * ```typescript
 * import { openai__OpenAI, anthropic__ChatAnthropic } from '@langchain/core/load/import_map';
 * ```
 * 
 * ## What this plugin does:
 * 
 * 1. **Discovers** all entrypoints from package.json exports field
 * 2. **Filters** entrypoints based on various criteria (deprecated, optional deps, etc.)
 * 3. **Transforms** entrypoint paths to proper export statements
 * 4. **Handles** extra import map entries with complex import/export patterns
 * 5. **Generates** a TypeScript file with all re-exports
 */
export function importMapPlugin(options: ImportMapPluginOptions): Plugin {
    const opts = {
        enabled: true,
        outputPath: 'load/import_map.ts',
        deprecatedNodeOnly: [],
        requiresOptionalDependency: [],
        deprecatedOmitFromImportMap: [],
        extraImportMapEntries: [],
        ...options,
    } as Required<ImportMapPluginOptions>;

    return {
        name: 'import-map',

        buildStart() {
            // @ts-expect-error - outputOptions is available in rolldown plugin context but not typed
            const outputOptions = this.outputOptions as OutputOptions;

            /**
             * only run plugin if:
             * - enabled is true
             * - outputOptions.format is es so we only run during ESM build
             */
            if (!opts.enabled || outputOptions.format !== 'es') {
                return;
            }

            try {
                // Get entrypoints from package.json exports
                const entrypoints = extractEntrypointsFromExports(opts.packageInfo.exports);

                // Generate import map
                const filteredEntrypoints = filterEntrypoints(entrypoints, opts);

                if (Object.keys(filteredEntrypoints).length > 0 || opts.extraImportMapEntries.length > 0) {
                    console.log(`🗺️  Generating import map with ${Object.keys(filteredEntrypoints).length} entrypoints`);
                    generateImportMap(opts.packagePath, filteredEntrypoints, opts);
                    console.log(`📝 Generated import map: ${opts.outputPath}`);
                }

            } catch (error) {
                console.warn('⚠️ Import map generation failed:', error);
            }
        },
    };
}

/**
 * Extract entrypoints from package.json exports field
 */
function extractEntrypointsFromExports(exports: PackageJson['exports']): Record<string, string> {
    if (!exports) return {};

    const entrypoints: Record<string, string> = {};

    for (const [key, value] of Object.entries(exports)) {
        // Skip package.json export
        if (key === './package.json') continue;

        // Normalize the key (remove ./ prefix, use 'index' for root)
        const normalizedKey = key === '.' ? 'index' : key.replace('./', '');

        if (typeof value === 'object' && value && 'input' in value) {
            // Use the input field to get the source file
            entrypoints[normalizedKey] = value.input as string;
        }
    }

    return entrypoints;
}

/**
 * Filter entrypoints based on configuration criteria
 */
function filterEntrypoints(
    entrypoints: Record<string, string>,
    opts: Required<ImportMapPluginOptions>
): Record<string, string> {
    const filtered: Record<string, string> = {};

    for (const [key, path] of Object.entries(entrypoints)) {
        // Skip if it's the special "load" entrypoint
        if (key === 'load') continue;

        // Skip if it's deprecated node-only
        if (opts.deprecatedNodeOnly.includes(key)) continue;

        // Skip if it requires optional dependency
        if (opts.requiresOptionalDependency.includes(key)) continue;

        // Skip if it's deprecated and should be omitted from import map
        if (opts.deprecatedOmitFromImportMap.includes(key)) continue;

        filtered[key] = path;
    }

    return filtered;
}

/**
 * Generate the import map TypeScript file
 */
function generateImportMap(
    packagePath: string,
    entrypoints: Record<string, string>,
    opts: Required<ImportMapPluginOptions>
): void {
    const outputPath = resolve(packagePath, 'src', opts.outputPath);

    // Ensure directory exists
    fs.mkdirSync(resolve(packagePath, 'src', 'load'), { recursive: true });

    // Create export statements for entrypoints
    const createImportStatement = (key: string, path: string) => {
        // Transform slashes to double underscores for export names
        const exportName = key.replace(/\//g, "__");

        // Transform the path to the compiled output
        // Remove ./ prefix, src/ prefix, and .ts extension
        const outputPath = path
            .replace(/^\.\//, "")
            .replace(/^src\//, "")
            .replace(/\.ts$/, ".js");

        return `export * as ${exportName} from "../${outputPath}";`;
    };

    const importMapExports = Object.entries(entrypoints)
        .map(([key, path]) => createImportStatement(key, path))
        .join("\n");

    // Handle extra import map entries
    let extraContent = "";
    if (opts.extraImportMapEntries.length > 0) {
        const extraImportData = opts.extraImportMapEntries.reduce<ImportData>(
            (data, { modules, alias, path }) => {
                const newData = { ...data };

                // Collect imports by path
                if (!newData.imports[path]) {
                    newData.imports[path] = [];
                }
                newData.imports[path] = [
                    ...new Set(newData.imports[path].concat(modules)),
                ];

                // Collect exported aliases
                const exportAlias = alias.join("__");
                if (!newData.exportedAliases[exportAlias]) {
                    newData.exportedAliases[exportAlias] = [];
                }
                newData.exportedAliases[exportAlias] =
                    newData.exportedAliases[exportAlias].concat(modules);

                return newData;
            },
            {
                imports: {},
                exportedAliases: {},
            }
        );

        // Generate import statements
        const extraImportStatements = Object.entries(extraImportData.imports).map(
            ([path, modules]) =>
                `import {\n  ${modules.join(",\n  ")}\n} from "${path}";`
        );

        // Generate alias declarations and exports
        const extraDeclarations = Object.entries(
            extraImportData.exportedAliases
        ).map(([exportAlias, modules]) =>
            [
                `const ${exportAlias} = {\n  ${modules.join(",\n  ")}\n};`,
                `export { ${exportAlias} };`,
            ].join("\n")
        );

        extraContent = `${extraImportStatements.join(
            "\n"
        )}\n${extraDeclarations.join("\n")}\n`;

        // Clean up empty extra content
        extraContent = extraContent.trim();
        if (!/[a-zA-Z0-9]/.test(extraContent)) {
            extraContent = "";
        }
    }

    const fileContent = `// Auto-generated by import-map plugin. Do not edit manually.

${importMapExports}${extraContent ? '\n' + extraContent : ''}`;

    // Only write if content has changed to avoid unnecessary rebuilds
    let shouldWrite = true;
    try {
        const existingContent = fs.readFileSync(outputPath, 'utf-8');
        shouldWrite = existingContent !== fileContent;
    } catch {
        // File doesn't exist, so we should write it
    }

    if (shouldWrite) {
        fs.writeFileSync(outputPath, fileContent);
    }
} 