import { langchainConfig, type ConfigArray } from "@langchain/eslint";

/**
 * Packages bundled via `noExternal` in tsdown.config.ts.
 * These packages are ESM-only and bundled into the output for CJS compatibility.
 * They only need to be devDependencies, not runtime dependencies.
 * Listed here as core-modules so import/no-extraneous-dependencies ignores them.
 */
const bundledPackages = [
  "p-retry",
  "p-queue",
  "ansi-styles",
  "camelcase",
  "decamelize",
];

const config: ConfigArray = [
  ...langchainConfig,
  {
    ignores: ["src/utils/zod-to-json-schema/**"],
  },
  {
    // Treat bundled packages as core modules so they don't need to be in dependencies
    settings: {
      "import/core-modules": bundledPackages,
    },
  },
];
export default config;
