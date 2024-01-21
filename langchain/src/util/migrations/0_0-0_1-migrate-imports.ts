import { Project, SyntaxKind } from "ts-morph";
import { glob } from "glob";
import path from "node:path";

type ExportedSymbol = { symbol: string; kind: SyntaxKind };

type EntrypointAndSymbols = {
  entrypoint: string;
  exportedSymbols: Array<ExportedSymbol>;
};

/**
 * @param {string} entrypointFile
 * @param {Project} project
 * @returns {Array<EntrypointAndSymbols> }
 */
function getEntrypointsFromFile(
  entrypointFile: string,
  project: Project
): Array<EntrypointAndSymbols> {
  // load file contents from ts-morph
  const file = project.addSourceFileAtPath(entrypointFile);
  // extract the variable named entrypoints
  const entrypointVar = file.getVariableDeclarationOrThrow("entrypoints");
  // extract the `deprecatedNodeOnly` if it exists
  const deprecatedNodeOnlyVar =
    file.getVariableDeclaration("deprecatedNodeOnly");
  let deprecatedNodeOnly: Array<string> = [];
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

  const entrypointsObject: Record<string, string> =
    Object.fromEntries(entrypointKeysArray);

  const result = Object.entries(entrypointsObject).flatMap(([key, value]) => {
    if (deprecatedNodeOnly.includes(key)) {
      return [];
    }
    const newFile = project.addSourceFileAtPath(
      path.join(
        entrypointFile.replace("scripts/create-entrypoints.js", "src"),
        `${value}.ts`
      )
    );
    const exportedSymbolsMap = newFile.getExportedDeclarations();
    const exportedSymbols = Array.from(exportedSymbolsMap.entries()).map(
      ([symbol, declarations]) => ({
        kind: declarations[0].getKind(),
        symbol,
      })
    );
    return {
      entrypoint: key,
      exportedSymbols,
    };
  });

  return result;
}

/**
 * Finds a matching symbol in the array of exported symbols.
 * @param {{ symbol: string, kind: SyntaxKind }} target - The target symbol and its kind to find.
 * @param {Array<EntrypointAndSymbols>} exportedSymbols - The array of exported symbols to search.
 * @returns {{ entrypoint: string, foundSymbol: string } | undefined} The matching symbol or undefined if not found.
 */
function findMatchingSymbol(
  target: { symbol: string; kind: SyntaxKind },
  exportedSymbols: Array<EntrypointAndSymbols>
): { entrypoint: string; foundSymbol: string } | undefined {
  for (const entry of exportedSymbols) {
    const foundSymbol = entry.exportedSymbols.find(
      ({ symbol, kind }) => symbol === target.symbol && kind === target.kind
    );
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
 * @param {Array<EntrypointAndSymbols>} entrypoints
 * @returns {Array<EntrypointAndSymbols>}
 */
function removeLoad(
  entrypoints: Array<EntrypointAndSymbols>
): Array<EntrypointAndSymbols> {
  return entrypoints.flatMap((entrypoint) => {
    const newEntrypoint =
      entrypoint.entrypoint === "index" ? "" : `/${entrypoint.entrypoint}`;
    const withoutLoadOrIndex = entrypoint.exportedSymbols.filter((item) => {
      if (item.symbol === "load" && newEntrypoint === "load") {
        return false;
      }
      return true;
    });
    return {
      entrypoint: newEntrypoint,
      exportedSymbols: withoutLoadOrIndex,
    };
  });
}

/**
 * Find imports from deprecated pre 0.1 LangChain modules and update them to import
 * from the new LangChain packages.
 */
export async function updateEntrypointsFrom0_0_xTo0_1_x({
  localLangChainPath,
  codePath,
  customGlobPattern,
  customIgnorePattern,
}: {
  /**
   * The absolute path to the locally cloned LangChain repo root.
   * @example "/Users/username/code/langchainjs"
   */
  localLangChainPath: string;
  /**
   * The absolute path to the source directory of the codebase to update.
   * @example "/Users/username/code/my-project/src"
   */
  codePath: string;
  /**
   * Optionally, pass in a custom glob pattern to match files.
   * The backslash included in the example and default is only for
   * JSDoc to escape the asterisk. Do not include unless intentionally.
   * @example "/*.d.ts"
   * @default "**\/*.ts"
   */
  customGlobPattern?: string;
  /**
   * A custom ignore pattern for ignoring files.
   * The backslash included in the example and default is only for
   * JSDoc to escape the asterisk. Do not include unless intentionally.
   * @example {["**\/node_modules/**", "**\/dist/**", "**\/*.d.ts"]}
   * @default {["**\/node_modules/**", "**\/dist/**", "**\/*.d.ts"]}
   */
  customIgnorePattern?: string[] | string;
}) {
  const project = new Project();

  const langchainCorePackageEntrypoints = removeLoad(
    getEntrypointsFromFile(
      path.join(
        localLangChainPath,
        "langchain-core",
        "scripts",
        "create-entrypoints.js"
      ),
      project
    )
  );

  const langchainCommunityPackageEntrypoints = removeLoad(
    getEntrypointsFromFile(
      path.join(
        localLangChainPath,
        "libs",
        "langchain-community",
        "scripts",
        "create-entrypoints.js"
      ),
      project
    )
  );

  const langchainOpenAIPackageEntrypoints = removeLoad(
    getEntrypointsFromFile(
      path.join(
        localLangChainPath,
        "libs",
        "langchain-openai",
        "scripts",
        "create-entrypoints.js"
      ),
      project
    )
  );

  console.log(
    "langchainCorePackageEntrypoints.length",
    langchainCorePackageEntrypoints.length
  );
  console.log(
    "langchainCommunityPackageEntrypoints.length",
    langchainCommunityPackageEntrypoints.length
  );
  console.log(
    "langchainOpenAIPackageEntrypoints.length",
    langchainOpenAIPackageEntrypoints.length
  );

  const globPattern = customGlobPattern || "/**/*.ts";
  const ignorePattern = customIgnorePattern || [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.d.ts",
  ];

  const allCodebaseFiles = glob
    .sync(path.join(codePath, globPattern), { ignore: ignorePattern })
    .map((filePath) => path.resolve(filePath));
  console.log("allCodebaseFiles.length", allCodebaseFiles.length);

  for await (const filePath of allCodebaseFiles) {
    const projectFile = project.addSourceFileAtPath(filePath);
    const imports = projectFile.getImportDeclarations();
    console.log("imports", imports.length)
    imports.forEach((importItem) => {
      // Get all imports
      const module = importItem.getModuleSpecifierValue();
      // Get only the named imports. Eg: import { foo } from "langchain/util";
      const namedImports = importItem.getNamedImports();
      if (!module.startsWith("langchain/")) {
        return;
      }
      console.log("Found langchain import!");
      // look at each import and see if it exists in
      let didUpdate = false;

      namedImports.forEach((namedImport) => {
        const namedImportText = namedImport.getText();
        let namedImportKind: SyntaxKind | null = null;

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

        // If we couldn't find the kind of the named imports kind, skip it
        if (!namedImportKind) {
          console.log("no named imports")
          return;
        }

        const matchingSymbolCore = findMatchingSymbol(
          { symbol: namedImportText, kind: namedImportKind },
          langchainCorePackageEntrypoints
        );
        const matchingSymbolCommunity = findMatchingSymbol(
          { symbol: namedImportText, kind: namedImportKind },
          langchainCommunityPackageEntrypoints
        );
        const matchingSymbolOpenAI = findMatchingSymbol(
          { symbol: namedImportText, kind: namedImportKind },
          langchainOpenAIPackageEntrypoints
        );

        if (matchingSymbolCore) {
          console.debug(
            "Found matching symbol from `@langchain/core` package.",
            {
              matchingSymbol: matchingSymbolCore,
            }
          );

          namedImport.remove();
          projectFile.addImportDeclaration({
            moduleSpecifier: `@langchain/core${matchingSymbolCore.entrypoint}`,
            namedImports: [namedImportText],
          });
          didUpdate = true;
        } else if (matchingSymbolCommunity) {
          console.debug(
            "Found matching symbol from `@langchain/community` package.",
            {
              matchingSymbol: matchingSymbolCommunity,
            }
          );

          namedImport.remove();
          projectFile.addImportDeclaration({
            moduleSpecifier: `@langchain/community${matchingSymbolCommunity.entrypoint}`,
            namedImports: [namedImportText],
          });
          didUpdate = true;
        } else if (matchingSymbolOpenAI) {
          console.debug(
            "Found matching symbol from `@langchain/openai` package.",
            {
              matchingSymbol: matchingSymbolOpenAI,
            }
          );

          namedImport.remove();
          projectFile.addImportDeclaration({
            moduleSpecifier: `@langchain/openai${matchingSymbolOpenAI.entrypoint}`,
            namedImports: [namedImportText],
          });
          didUpdate = true;
        }
      });

      if (didUpdate) {
        projectFile.saveSync();

        // Check if all named imports were removed, and only a file import remains.
        // eg: import { foo } from "langchain/anthropic"; -> import "langchain/anthropic";
        // if so, remove the import entirely
        const importClause = importItem.getImportClause();
        if (
          !importClause ||
          (!importClause.getDefaultImport() &&
            importClause.getNamedImports().length === 0)
        ) {
          importItem.remove();
          projectFile.saveSync();
        }
      }
    });
  }
}
