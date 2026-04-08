import type { UserConfig as BuildOptions } from "tsdown";
import type { PackageJson } from "type-fest";
import path from "node:path";

export {
  type CjsCompatPluginOptions,
  cjsCompatPlugin,
} from "./plugins/cjs-compat.ts";
export {
  type ImportConstantsPluginOptions,
  importConstantsPlugin,
} from "./plugins/import-constants.ts";
export {
  type ImportMapPluginOptions,
  importMapPlugin,
} from "./plugins/import-map.ts";
export {
  type SecretPluginOptions,
  lcSecretsPlugin,
} from "./plugins/lc-secrets.ts";

/**
 * Creates a standardized tsdown build configuration for LangChain packages.
 *
 * This function generates a build configuration with sensible defaults for building
 * LangChain packages, including:
 * - Dual format output (CommonJS and ESM)
 * - TypeScript declaration files
 * - Source maps
 * - Validation via ATTW, publint, and unused exports checking
 *
 * @param options - Optional partial build options to override defaults
 * @returns A complete tsdown build configuration object
 *
 * @example
 * ```ts
 * // tsdown.config.ts
 * import { getBuildConfig } from "@langchain/build";
 *
 * export default getBuildConfig();
 * ```
 *
 * @example
 * ```ts
 * // tsdown.config.ts
 * import { getBuildConfig } from "@langchain/build";
 *
 * export default getBuildConfig({
 *   plugins: [myCustomPlugin()],
 * });
 * ```
 */
export function getBuildConfig(options?: Partial<BuildOptions>): BuildOptions {
  return {
    format: ["cjs", "esm"],
    target: "es2022",
    platform: "node",
    // rolldown/tsdown can emit `.mjs` for ESM when `fixedExtension` is enabled.
    // We want stable `.js` ESM output for `"type": "module"` packages.
    fixedExtension: false,
    dts: {
      parallel: true,
      tsgo: true,
      build: true,
    },
    sourcemap: true,
    unbundle: true,
    // In unbundle (transpile-only) mode, dependencies remain as external imports
    // and should not trigger "bundled dependency" warnings. Setting inlineOnly
    // to false suppresses these warnings for all packages. Individual packages
    // can override this with a specific allowlist if needed.
    inlineOnly: false,
    exports: {
      customExports: async (exports, context) => {
        // context.pkg holds the original package.json (including any hand-authored
        // export conditions such as "browser"). We use it as the source of truth
        // for extra conditions that tsdown doesn't know about.
        const pkgExports =
          (
            context as {
              pkg?: { exports?: Record<string, Record<string, unknown>> };
            }
          ).pkg?.exports ?? {};

        return Object.entries(exports).reduce(
          (acc, [key, value]) => {
            if (
              typeof value === "object" &&
              value !== null &&
              "import" in value
            ) {
              // Use path.posix to ensure forward slashes on all platforms.
              // On Windows, path.join/dirname produce backslash paths which
              // break package.json exports and publint validation.
              const importValue = value.import.replace(/\\/g, "/");
              const dir = path.posix.dirname(importValue);
              const base = path.posix.basename(
                importValue,
                path.posix.extname(importValue)
              );
              const outputPath = path.posix.join(dir, base);
              const inputPath = path.posix.join(
                dir.replace("./dist", "./src"),
                `${base}.ts`
              );

              // Carry forward any extra conditions (e.g. "browser") that were
              // hand-authored in the original package.json export entry.
              // These are absent from the tsdown-generated `exports` argument,
              // so we have to read them from `context.pkg`.
              const pkgEntry = pkgExports[key];
              const extraConditions: Record<string, unknown> = {};
              if (typeof pkgEntry === "object" && pkgEntry !== null) {
                for (const [cond, val] of Object.entries(pkgEntry)) {
                  if (!["input", "require", "import"].includes(cond)) {
                    extraConditions[cond] = val;
                  }
                }
              }

              acc[key] = {
                /**
                 * We may have custom exports set (e.g. "browser") that are not part of
                 * the standard require/import/input triple.
                 */
                ...extraConditions,
                /**
                 * These should always be set and not overridden.
                 */
                input: `./${inputPath}`,
                require: {
                  types: `./${outputPath}.d.cts`,
                  default: `./${outputPath}.cjs`,
                },
                import: {
                  types: `./${outputPath}.d.ts`,
                  default: `./${outputPath}.js`,
                },
              };
            } else {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, PackageJson.ExportConditions>
        );
      },
    },
    attw: {
      profile: "node16",
      level: "error",
    },
    publint: {
      level: "error",
      strict: true,
    },
    unused: {
      level: "error",
    },
    ignoreWatch: [`.turbo`, `dist`, `node_modules`],
    ...options,
  };
}
