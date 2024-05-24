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
    chat_models: "src/chat_models.ts",
    embeddings: "src/embeddings.ts",
    index: "src/index.ts",
    llms: "src/llms.ts",
  },
  tsConfigPath: resolve("./tsconfig.json"),
  cjsSource: "./dist-cjs",
  cjsDestination: "./dist",
  abs,
  tSupConfig: {
    name: "@langchain/yandex",
    dts: true,
    format: ["cjs", "esm"],
    splitting: false,
    sourcemap: false,
    clean: true,
    platform: "node",
    outDir: `dist`,
    tsconfig: `tsconfig.json`,
  }
}