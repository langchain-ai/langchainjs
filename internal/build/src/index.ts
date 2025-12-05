import type { Options as BuildOptions } from "tsdown";
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
    dts: {
      parallel: true,
      tsgo: true,
      build: true,
    },
    sourcemap: true,
    unbundle: true,
    exports: {
      customExports: async (exports) => {
        return Object.entries(exports).reduce(
          (acc, [key, value]) => {
            if (
              typeof value === "object" &&
              value !== null &&
              "import" in value
            ) {
              const outputPath = path.join(
                path.dirname(value.import),
                path.basename(value.import, path.extname(value.import))
              );
              const inputPath = path.join(
                path.dirname(value.import).replace("./dist", "./src"),
                `${path.basename(value.import, path.extname(value.import))}.ts`
              );
              acc[key] = {
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
