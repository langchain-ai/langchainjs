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
    index: "index",
    build: "build",
    migrations: "migrations/index",
    check_broken_links: "check_broken_links",
  },
  tsConfigPath: resolve("./tsconfig.json"),
  cjsSource: "./dist-cjs",
  cjsDestination: "./dist",
  abs,
  additionalGitignorePaths: ["!bin/build.js", "dist_build"]
}
