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
    index: "index",
    utils: "utils/index",
    types: "types",
    "experimental/media": "experimental/media",
    "experimental/utils/media_core": "experimental/utils/media_core",
  },
  tsConfigPath: resolve("./tsconfig.json"),
  cjsSource: "./dist-cjs",
  cjsDestination: "./dist",
  abs,
};
