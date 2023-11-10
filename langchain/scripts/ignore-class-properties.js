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
    if (!previousLine.includes("@ignore")) {
      if (asyncMethodRegex.test(line)) {
        result += "  /** @ignore */\n";
      }
    }

    result += line + "\n";
    previousLine = line;
  }

  // Ensure only one newline is present at bottom of each file.
  const finalResult = result.trim() + "\n";
  await writeFile(filePath, finalResult);
  console.log("File processed successfully.");
}

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