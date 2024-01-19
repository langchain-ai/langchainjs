import { moveAndRename } from "@langchain/scripts";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} relativePath 
 * @returns {string}
 */
function abs(relativePath) {
  return resolve(dirname(fileURLToPath(import.meta.url)), relativePath);
}

moveAndRename({
  source: "../dist-cjs",
  dest: "../dist",
  abs,
});
