import { defineConfig } from "tsdown";
import {
  getBuildConfig,
  importConstantsPlugin,
  importMapPlugin,
  lcSecretsPlugin,
} from "@langchain/build";

export default defineConfig([
  getBuildConfig({
    plugins: [
      lcSecretsPlugin({
        enabled: process.env.SKIP_SECRET_SCANNING !== "true",
        strict: process.env.NODE_ENV === "production",
        packagePath: "./package.json",
      }),
      importConstantsPlugin({
        enabled: process.env.SKIP_IMPORT_CONSTANTS !== "true",
        optionalEntrypoints: [],
      }),
      importMapPlugin({
        enabled: process.env.SKIP_IMPORT_MAP !== "true",
        extraImportMapEntries: [],
        deprecatedOmitFromImportMap: [
          "context",
          "callbacks/dispatch/web",
          "callbacks/dispatch",
        ],
      }),
    ],
  }),
]);
