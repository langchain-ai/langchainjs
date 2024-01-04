const fs = require("fs/promises");
const { Project, SyntaxKind } = require("ts-morph");
const { glob } = require("glob");
const path = require("path");

/**
  * @param {string} entrypointFile 
  * @param {Project} project
  * @returns {Array<{ entrypoint: string, exportedSymbols: Array<string> }>}
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
    const exportedSymbols = [...exportedSymbolsMap.keys()];
    return {
      entrypoint: key,
      exportedSymbols,
    }
  });

  return result;
}

const LANGCHAIN_ANTHROPIC_PREFIX = `@langchain/anthropic`;


/**
 * 
 * @param {string} packageName 
 * @param {string} packagePath
 */
async function main(packageName, packagePath) {
  const project = new Project();

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainPackageEntrypoints = getEntrypointsFromFile(path.join(packagePath, "scripts", "create-entrypoints.js"), project);

  const allExamplesTsFiles = glob.sync("./examples/src/**/*.ts").map((filePath) => path.resolve(filePath));

  let iter = 0;
  for await (const exampleFilePath of allExamplesTsFiles) {
    const exampleFile = project.addSourceFileAtPath(exampleFilePath);
    const exampleFileName = path.basename(exampleFilePath);
    const imports = exampleFile.getImportDeclarations();

    imports.flatMap((importItem) => {
      // get whatever was imported
      const module = importItem.getModuleSpecifierValue();
      const namedImports = importItem.getNamedImports();
      if (!module.startsWith("langchain/")) {
        return [];
      }

      let didUpdate = false;

      namedImports.forEach((namedImport) => {
        const namedImportText = namedImport.getText();
        const matchingPackageEntrypoint = langchainPackageEntrypoints
          .find(
            ({ exportedSymbols }) =>
              exportedSymbols.find((symbolName) => symbolName === namedImportText)
          );

        if (matchingPackageEntrypoint) {
          console.log("Found matching symbol in package", {
            exampleFile: exampleFileName,
            importedSymbol: namedImportText
          });
        }

        if (matchingPackageEntrypoint) {
          // The core entrypoint matches the lc proper entrypoint
          const hasMatchingExportedSymbol = matchingPackageEntrypoint.exportedSymbols.find((symbolName) => symbolName === namedImportText);
          if (hasMatchingExportedSymbol) {
            // the core entrypoint has a matching symbol.
            console.log("replace", module, namedImportText, "with", packageName);

            // remove individual import
            // namedImport.remove();
            // add a new named import
            // exampleFile.addImportDeclaration({
            //   moduleSpecifier: packageName,
            //   namedImports: [namedImportText],
            // });
            // didUpdate = true;
          }
        }
      })

      if (didUpdate) {
        exampleFile.saveSync();

        // Check if all named imports were removed, and only a file import remains.
        // eg: import { foo } from "langchain/anthropic"; -> import "langchain/anthropic";
        // if so, remove the import entirely
        const importClause = importItem.getImportClause();
        if (!importClause || (!importClause.getDefaultImport() && importClause.getNamedImports().length === 0)) {
          importItem.remove();
          exampleFile.saveSync();
        }
        iter += 1;
        console.log("updated", exampleFileName, "iter", iter)
      }

      return {
        module,
        namedImports
      }
    })
  }
}

const PACKAGE_NAME = `@langchain/google-genai`;
const PACKAGE_PATH = "./libs/langchain-google-genai";

main(PACKAGE_NAME, PACKAGE_PATH);
