import { Project } from "ts-morph";
import { glob } from "glob";
import path from "path";
import fs from "fs";

interface ExportedSymbol {
  name: string;
  filePath: string;
}

function getExportedSymbolsAndFilePaths(filePath: string): string[] {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);

  // Get all exported symbols from the specified file
  const exports = sourceFile.getExportSymbols();
  const exportedSymbolNames = exports.map((symbol) => symbol.getName());
  return exportedSymbolNames;
}

function findNewlyExportedSymbols(directories: string[], symbols: string[]) {
  const allTsFilesInDirectories = directories.map((directory) => {
    return glob.sync(path.join(directory, '**', '*.ts'));
  }).flat();
  console.log(allTsFilesInDirectories.length)

  const project = new Project();
  const sourceFiles = project.addSourceFilesAtPaths(allTsFilesInDirectories);

  let exportedSymbols: ExportedSymbol[] = [];

  sourceFiles.forEach((file) => {
    const fileExports = file.getExportSymbols();
    fileExports.forEach(symbol => {
      const symbolName = symbol.getName();
      if (symbols.find((name) => name === symbolName)) {
        // If the symbol is already exported from an index.ts file, do not add it again
        if (!exportedSymbols.find((item) => item.name === symbolName && item.filePath.endsWith("index.ts"))) {
          exportedSymbols.push({
            name: symbol.getName(),
            filePath: file.getFilePath().split("brace/oh-two-migration-script/")[1]
          });

          const storedSymbols = exportedSymbols.filter((item) => item.name === symbolName);
          if (storedSymbols.length > 1) {
            // remove any non index.ts files
            if (exportedSymbols.find((item) => item.name === symbolName && item.filePath.endsWith("index.ts"))) {
              exportedSymbols = exportedSymbols.filter((item) => {
                if (item.name === symbolName && !item.filePath.endsWith("index.ts")) {
                  return false;
                }
                return true;
              })
            }
          }
        }
      }
    });
  });

  return exportedSymbols;
}

function convertOldPathToNewImport(oldPath: string): string {
  if (oldPath.endsWith("/index.ts")) {
    oldPath = oldPath.split("/index.ts")[0];
  }
  let ending = oldPath.split("src/")[1];
  if (ending.endsWith(".ts")) {
    ending = ending.split(".ts")[0];
  }
  if (oldPath.includes("langchain-core")) {
    return `@langchain/core/${ending}`;
  } else if (oldPath.includes("langchain-community")) {
    return `@langchain/community/${ending}`;
  } else {
    throw new Error(`Unknown path: ${oldPath}`)
  }
}

function createImportMap(symbols: ExportedSymbol[]): Array<{ old: string, new: string, symbol: string }> {
  return symbols.map(symbol => {
    return {
      old: "langchain/agents/*",
      new: convertOldPathToNewImport(symbol.filePath),
      symbol: symbol.name
    }
  });
}

function main() {
  const oldExportedSymbols = getExportedSymbolsAndFilePaths("../../langchain/src/agents/index.ts");
  const directories = [
    "../../langchain-core/src",
    "../**/src",
  ];
  console.log("oldExportedSymbols\n\n----------\n", oldExportedSymbols)
  console.log("\n\n----------\n")
  const newlyExportedSymbols = findNewlyExportedSymbols(directories, oldExportedSymbols);

  console.log("newlyExportedSymbols\n\n----------\n", newlyExportedSymbols)
  console.log("\n\n----------\n")
  const importMap = createImportMap(newlyExportedSymbols);
  console.log("importMap\n\n----------\n", importMap)
  const importMapJson: Array<{ old: string, new: string, symbol: string | null }> = JSON.parse(fs.readFileSync("importMap.json", "utf-8"));
  const combinedMap = importMapJson.concat(importMap);
  fs.writeFileSync("importMap.json", JSON.stringify(combinedMap, null, 2));
}

main()