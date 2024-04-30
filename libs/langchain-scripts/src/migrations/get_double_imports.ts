import { Project, Symbol } from "ts-morph";
import { glob } from "glob";
import path from "path";
import fs from "fs";
import { getExportsFromFiles } from "./get_all_re_exports.js";

interface ExportedSymbol {
  name: string | null;
  filePath: string;
  originalPath: string;
}

type SymbolPath = { symbol: string, path: string }

function getExportedSymbolsFromPaths(filePaths: string[]): Array<SymbolPath> {
  const project = new Project();
  const sourceFiles = project.addSourceFilesAtPaths(filePaths);

  const exports: Array<{ path: string, symbols: Symbol[]}> = [];
  sourceFiles.forEach((file) => {
    exports.push({
      path: file.getFilePath(),
      symbols: file.getExportSymbols(),
    });
  });

  // Get all exported symbols from the specified file
  const exportedSymbolNames: Array<SymbolPath> = [];
  exports.map((symbol) => {
    const filePath = symbol.path;
    const symbolNames = symbol.symbols.map((s) => s.getName());
    symbolNames.forEach((name) => {
      exportedSymbolNames.push({ symbol: name, path: filePath });
    });
  });
  return exportedSymbolNames;
}


function findNewlyExportedSymbols(directories: string[], symbols: Array<SymbolPath>) {
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
      const foundSymbol = symbols.find((s) => s.symbol === symbolName);
      if (foundSymbol) {
        // If the symbol is already exported from an index.ts file, do not add it again
        if (!exportedSymbols.find((item) => item.name === symbolName && item.filePath.endsWith("index.ts"))) {
          exportedSymbols.push({
            name: symbolName,
            filePath: file.getFilePath().split("brace/oh-two-migration-script/")[1],
            originalPath: foundSymbol.path,
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
  if (ending?.endsWith(".ts")) {
    ending = ending.split(".ts")[0];
  }

  if (oldPath.endsWith("/src")) {
    ending = "";
  }


  if (oldPath.includes("langchain-core")) {
    return `@langchain/core/${ending}`;
  } else if (oldPath.includes("langchain-community")) {
    return `@langchain/community/${ending}`;
  } else {
    // split the path at libs/, and /src and get what's in between
    const splitPath = oldPath.split("libs/")[1].split("/src")[0];
    const newPkg = `@${splitPath.split("-").join("/")}`;
    if (ending === "") {
      return newPkg;
    }
    return `${newPkg}/${ending}`;

  }
}

function convertOriginalPathToImport(originalPath: string) {
  if (originalPath.endsWith("index.ts")) {
    const splitPath = originalPath.split("index.ts")[0].split("../../")[1].replace("src/", "")
    // splitPath should now be in the format of "langchain/src/stores/message/redis"
    return splitPath.endsWith("/") ? splitPath + "*" : splitPath + "/*";
  } else {
    // just remove .ts and src
    return originalPath.split("../../")[1].replace("src/", "").replace(".ts", "");
  }
}

function createImportMap(symbols: ExportedSymbol[]): Array<ImportMap> {
  return symbols.map(symbol => {
    return {
      old: convertOriginalPathToImport(symbol.originalPath),
      new: convertOldPathToNewImport(symbol.filePath),
      symbol: symbol.name
    }
  });
}

function createImportMapStarImports(symbols: Array<{ old: string, new: string, symbol: string | null }>): Array<ImportMap> {
  return symbols.map(symbol => {
    return {
      old: convertOriginalPathToImport(symbol.old),
      new: symbol.new,
      symbol: null
    }
  });
}

type ImportMap = { old: string, new: string, symbol: string | null }


function main() {
  const allFiles = glob.globSync("../../langchain/src/**/*.ts");
  // const oldExportedSymbols = getExportedSymbolsFromPaths(allFiles);
  // const directories = [
  //   "../../langchain-core/src",
  //   "../**/src",
  // ];
  // console.log("oldExportedSymbols\n\n----------\n", oldExportedSymbols)
  // console.log("\n\n----------\n")
  // const newlyExportedSymbols = findNewlyExportedSymbols(directories, oldExportedSymbols);

  // console.log("newlyExportedSymbols\n\n----------\n", newlyExportedSymbols)
  // console.log("\n\n----------\n")
  const starExports = getExportsFromFiles(allFiles);
  const importMapStarImports = createImportMapStarImports(starExports);
  // const importMap = createImportMap(starExports);
  // console.log("importMap\n\n----------\n", importMap)
  const importMapJson: Array<ImportMap> = JSON.parse(fs.readFileSync("importMap_new.json", "utf-8"));
  const combinedMap = importMapJson.concat(importMapStarImports);
  fs.writeFileSync("importMap_new.json", JSON.stringify(combinedMap, null, 2));
}

main()