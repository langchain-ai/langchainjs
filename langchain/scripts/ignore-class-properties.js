import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join } from "path";

/**
 * @param {string} filePath
 */
async function processIgnoredClassProperties(filePath) {
  const data = await readFile(filePath, "utf-8");
  const lines = data.split("\n");

  let result = "";
  let previousLine = "";

  for (const line of lines) {
    const asyncMethodRegex = /^\s{2}(static\s+|get\s+|async\s+\*?|)(lc_|_)/;
    if (!previousLine.includes("@ignore") && asyncMethodRegex.test(line)) {
      if (previousLine.startsWith("   */")) {
        // Removes the `*/` from the previous line, replacing it
        // with `@ignore` and then closing the JSDoc comment.
        const splitNewLines = result.split("\n");
        splitNewLines.pop();
        splitNewLines.pop();
        result = splitNewLines.join("\n");
        result +=  '\n   * @ignore\n   */\n';
      } else if (previousLine.startsWith(" */")) {
        // handle single line jsdoc
        // remove the */ from the previous line, replacing it with `@ignore */`
      } else {
        result += "  /** @ignore */\n";
      }
    }

    result += line + "\n";
    previousLine = line;
  }

  // Ensure only one newline is present at bottom of each file.
  const finalResult = result.trim() + "\n";
  await writeFile(filePath, finalResult);
}

/**
 * Gets all files ending with `.ts` in the given directory.
 * @param {string} dir 
 * @param {Array<string>} fileList 
 * @returns {Promise<Array<string>>}
 */
async function getAllTsFiles(dir, fileList = []) {
  const files = await readdir(dir);

  await Promise.all(files.map(async (file) => {
    const filePath = join(dir, file);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      await getAllTsFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') && !filePath.endsWith('.test.ts')) {
      fileList.push(filePath);
    }
  }));
  return fileList;
}

async function processFiles() {
  const dir = join(process.cwd(), "src");
  const allTsFiles = await getAllTsFiles(dir);

  await Promise.all(allTsFiles.map(async (file) => {
    await processIgnoredClassProperties(file);
  }));
}
processFiles();
