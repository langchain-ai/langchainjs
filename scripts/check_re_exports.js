const fs = require("fs/promises");
const { Project, SyntaxKind } = require("ts-morph");
const { glob } = require("glob");
const path = require("path");

/**
  * @param {string} entrypointFile 
  * @param {Project} project
  * @returns {Array<{ entrypoint: string, exportedSymbols: Array<{ symbol: string kind: SyntaxKind }> }>}
  */
function getEntrypointsFromFile(entrypointFile, project) {
  // load file contents from ts-morph
  const file = project.addSourceFileAtPath(entrypointFile);
  // extract the variable named entrypoints
  const entrypointVar = file.getVariableDeclarationOrThrow("entrypoints");
  // extract the `deprecatedNodeOnly` if it exists
  const deprecatedNodeOnlyVar =
    file.getVariableDeclaration("deprecatedNodeOnly");
  /** @type {Array<string>} */
  let deprecatedNodeOnly = [];
  if (deprecatedNodeOnlyVar) {
    const deprecatedNodeOnlyKeys = deprecatedNodeOnlyVar
      .getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)
      .getElements()
      .map((element) => element.getText().replaceAll('"', ""));
    deprecatedNodeOnly = deprecatedNodeOnlyKeys;
  }
  // get all keys from the entrypoints object
  const entrypointKeys = entrypointVar
    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    .getProperties()
    .map((property) => property.getText());
  const entrypointKeysArray = entrypointKeys.map((kv) =>
    kv.split(":").map((part) => part.trim().replace(/^"|"$/g, ""))
  );

  /** @type {Record<string, string>} */
  const entrypointsObject = Object.fromEntries(entrypointKeysArray);

  const result = Object.entries(entrypointsObject).flatMap(([key, value]) => {
    if (deprecatedNodeOnly.includes(key)) {
      return [];
    }
    const newFile = project.addSourceFileAtPath(path.join(entrypointFile.replace("scripts/create-entrypoints.js", "src"), `${value}.ts`));
    const exportedSymbolsMap = newFile.getExportedDeclarations();
    const exportedSymbols = Array.from(exportedSymbolsMap.entries()).map(([symbol, declarations]) => {
      return {
        kind: declarations[0].getKind(),
        symbol
      };
    });
    return {
      // entrypoint: path.resolve(path.join(entrypointFile.replace("scripts/create-entrypoints.js", "src"), `${value}.ts`)),
      entrypoint: key,
      exportedSymbols,
    }
  });

  return result;
}

/**
 * Finds a matching symbol in the array of exported symbols.
 * @param {{ symbol: string, kind: SyntaxKind }} target - The target symbol and its kind to find.
 * @param {Array<{ entrypoint: string, exportedSymbols: Array<{ symbol: string kind: SyntaxKind }> }>} exportedSymbols - The array of exported symbols to search.
 * @returns {{ entrypoint: string, foundSymbol: string } | undefined} The matching symbol or undefined if not found.
 */
function findMatchingSymbol(target, exportedSymbols) {
  for (const entry of exportedSymbols) {
    const foundSymbol = entry.exportedSymbols.find(({ symbol, kind }) => symbol === target.symbol && kind === target.kind);
    if (foundSymbol) {
      return {
        entrypoint: entry.entrypoint,
        foundSymbol: foundSymbol.symbol,
      }; // Return the matching entry object
    }
  }
  return undefined; 
}


/**
 * @param {string} packageName 
 * @param {string} packagePath
 */
async function main(packageName, packagePath) {
  const project = new Project();

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  // const langchainPackageEntrypoints = getEntrypointsFromFile(path.join(packagePath, "scripts", "create-entrypoints.js"), project);

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainCorePackageEntrypoints = getEntrypointsFromFile(path.join("langchain-core", "scripts", "create-entrypoints.js"), project);
  console.log(langchainCorePackageEntrypoints[0])

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainCommunityPackageEntrypoints = getEntrypointsFromFile(path.join("libs", "langchain-community", "scripts", "create-entrypoints.js"), project);

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainOpenAIPackageEntrypoints = getEntrypointsFromFile(path.join("libs", "langchain-openai", "scripts", "create-entrypoints.js"), project);

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainAnthropicPackageEntrypoints = getEntrypointsFromFile(path.join("libs", "langchain-anthropic", "scripts", "create-entrypoints.js"), project);

  const allLangChainFiles = glob.sync("./langchain/src/**/*.ts").map((filePath) => path.resolve(filePath));

  let iter = 0;
  for await (const lcFilePath of allLangChainFiles) {
    const lcFile = project.addSourceFileAtPath(lcFilePath);
    const lcFileName = path.basename(lcFilePath);
    const imports = lcFile.getImportDeclarations();

    imports.flatMap((importItem) => {
      // get whatever was imported
      const module = importItem.getModuleSpecifierValue();
      const namedImports = importItem.getNamedImports();
      if (!module.startsWith(".")) {
        return [];
      }

      // look at each import and see if it exists in 

      let didUpdate = false;

      namedImports.forEach((namedImport) => {
        const namedImportText = namedImport.getText();
        /** @type {SyntaxKind | undefined} */
        let namedImportKind;

        const symbol = namedImport.getSymbol();
        if (symbol) {
          // Resolve alias symbol to its original symbol
          const aliasedSymbol = symbol.getAliasedSymbol() || symbol;
    
          // Get the original declarations of the symbol
          const declarations = aliasedSymbol.getDeclarations();
          if (declarations.length > 0) {
            // Assuming the first declaration is the original one
            const originalDeclarationKind = declarations[0].getKind();
            namedImportKind = originalDeclarationKind;
          }
        }

        if (!namedImportKind) {
          console.log("no kind found")
          return;
        }

        const matchingSymbolCore = findMatchingSymbol({ symbol: namedImportText, kind: namedImportKind }, langchainCorePackageEntrypoints);
        const matchingSymbolCommunity = findMatchingSymbol({ symbol: namedImportText, kind: namedImportKind }, langchainCommunityPackageEntrypoints);
        const matchingSymbolOpenAI = findMatchingSymbol({ symbol: namedImportText, kind: namedImportKind }, langchainOpenAIPackageEntrypoints);
        const matchingSymbolAnthropic = findMatchingSymbol({ symbol: namedImportText, kind: namedImportKind }, langchainAnthropicPackageEntrypoints);

        if (matchingSymbolCore) {
          console.log("Found matching symbol in core", matchingSymbolCore);

          namedImport.remove();
          lcFile.addImportDeclaration({
            moduleSpecifier: `@langchain/core/${matchingSymbolCore.entrypoint}`,
            namedImports: [namedImportText],
          });
          didUpdate = true;
        } else if (matchingSymbolCommunity) {
          console.log("Found matching symbol in community", matchingSymbolCommunity);

          namedImport.remove();
          lcFile.addImportDeclaration({
            moduleSpecifier: `@langchain/community/${matchingSymbolCommunity.entrypoint}`,
            namedImports: [namedImportText],
          });
          didUpdate = true;
        } else if (matchingSymbolOpenAI) {
          console.log("Found matching symbol in openai", matchingSymbolOpenAI);

          namedImport.remove();
          lcFile.addImportDeclaration({
            moduleSpecifier: `@langchain/openai/${matchingSymbolOpenAI.entrypoint}`,
            namedImports: [namedImportText],
          });
          didUpdate = true;
        } else if (matchingSymbolAnthropic) {
          console.log("Found matching symbol in anthropic", matchingSymbolAnthropic);

          namedImport.remove();
          lcFile.addImportDeclaration({
            moduleSpecifier: `@langchain/anthropic/${matchingSymbolAnthropic.entrypoint}`,
            namedImports: [namedImportText],
          });
          didUpdate = true;
        }
      })

      if (didUpdate) {
        lcFile.saveSync();

        // Check if all named imports were removed, and only a file import remains.
        // eg: import { foo } from "langchain/anthropic"; -> import "langchain/anthropic";
        // if so, remove the import entirely
        const importClause = importItem.getImportClause();
        if (!importClause || (!importClause.getDefaultImport() && importClause.getNamedImports().length === 0)) {
          importItem.remove();
          lcFile.saveSync();
        }
        iter += 1;
        console.log("updated", lcFileName, "iter", iter)
      }

      return {
        module,
        namedImports
      }
    })
  }
}

const PACKAGE_NAME = `@langchain/google-genai`;
const PACKAGE_PATH = "./langchain";

main(PACKAGE_NAME, PACKAGE_PATH);