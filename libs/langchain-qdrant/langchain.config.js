import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} relativePath
 * @returns {string}
 */
function abs(relativePath) {
  return resolve(dirname(fileURLToPath(import.meta.url)), relativePath);
}

export const config = {
  internals: [/node\:/, /@langchain\/core\//],
  entrypoints: {
    index: "src/index.ts",
  },
  requiresOptionalDependency: [],
  tsConfigPath: resolve("./tsconfig.json"),
  cjsSource: "./dist-cjs",
  cjsDestination: "./dist",
  abs,
  tSupConfig: {
    name: "@langchain/qdrant",
    dts: true,
    format: ["cjs", "esm"],
    splitting: false,
    sourcemap: true,
    clean: true,
    platform: "neutral",
    outDir: `dist`,
    tsconfig: `tsconfig.json`,
  }
};
