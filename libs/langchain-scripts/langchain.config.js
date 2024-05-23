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
  internals: [/node\:/],
  entrypoints: {
    index: "src/index.ts",
    build: "src/build.ts",
    migrations: "src/migrations/index.ts",
    check_broken_links: "src/check_broken_links.ts",
  },
  tsConfigPath: resolve("./tsconfig.json"),
  cjsSource: "./dist-cjs",
  cjsDestination: "./dist",
  abs,
  tSupConfig: {
    name: "@langchain/scripts",
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