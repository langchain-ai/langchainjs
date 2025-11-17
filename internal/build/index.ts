import { Options as BuildOptions } from "tsdown";

export {
  type CjsCompatPluginOptions,
  cjsCompatPlugin,
} from "./plugins/cjs-compat.js";
export {
  type ImportConstantsPluginOptions,
  importConstantsPlugin,
} from "./plugins/import-constants.js";
export {
  type ImportMapPluginOptions,
  importMapPlugin,
} from "./plugins/import-map.js";
export {
  type SecretPluginOptions,
  lcSecretsPlugin,
} from "./plugins/lc-secrets.js";

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
    },
    sourcemap: true,
    unbundle: true,
    exports: true,
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
