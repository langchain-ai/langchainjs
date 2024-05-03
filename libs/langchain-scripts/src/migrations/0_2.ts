import { glob } from "glob";
import { Project } from "ts-morph";
import fs from "node:fs";
import path from "node:path";

/**
 * TODO ADD THIS
 */
type ImportMapFallback = {
  old: string;
  new: string;
  symbolExceptions: string[];
};

const IMPORT_MAP_FALLBACKS = [
  {
    old: "langchain/memory",
    new: "langchain/memory/index",
    symbolExceptions: ["MotorheadMemory", "MotorheadMemoryInput"],
  },
];

function handleImportMapFallbacks(importMap: Array<DeprecatedEntrypoint>) {
  // if there was a no-op, after saving the project revisit all no-ops with the fallbacks.
}

const DEPRECATED_AND_DELETED_IMPORTS = [
  "PromptLayerOpenAI",
  "loadPrompt",
  "ChatGPTPluginRetriever",
];

type MigrationUpdate = {
  /**
   * The path of the file which was updated.
   */
  path: string;
  /**
   * The original import statement.
   */
  oldImport: string;
  /**
   * The updated import statement.
   */
  updatedImport: string;
};

export type DeprecatedEntrypoint = {
  old: string;
  new: string;
  symbol: string | null;
};

export interface UpdateLangChainFields {
  /**
   * The path to the project to check.
   * TypeScript files will be extracted
   * via this glob pattern: `${projectPath}/{star}{star}/{star}.{ts,tsx,js,jsx}`.
   * @optional - Not required if `files`, or 'tsConfigPath' is provided.
   */
  projectPath?: string;
  /**
   * A list of .ts file paths to check.
   * @optional - Not required if `projectPath`, or 'tsConfigPath' is provided.
   */
  files?: string[];
  /**
   * Path to the tsConfig file. This will be used to load
   * all the project files into the script.
   * @optional - Not required if `projectPath`, or 'files' is provided.
   */
  tsConfigPath?: string;
  /**
   * Whether or not to log a message when an import is updated.
   * @default false
   */
  shouldLog?: boolean;
  /**
   * Whether or not the invocation is a test run.
   * If `testRun` is set to true, the script will NOT save changes.
   * @default false
   */
  testRun?: boolean;
}

function findNewEntrypoint(
  importMap: Array<DeprecatedEntrypoint>,
  entrypointToReplace: string
): {
  newEntrypoint: string;
  symbols: Array<string> | null;
  isStarMatch: boolean;
} | null {
  const starMatches: Array<DeprecatedEntrypoint> = [];
  const exactEntrypoints: Array<DeprecatedEntrypoint> = [];
  importMap.map((item) => {
    if (item.old.endsWith("/*")) {
      const oldWithoutStar = item.old.replace("/*", "");
      const toReplaceBeginsWith =
        entrypointToReplace.startsWith(oldWithoutStar);
      if (toReplaceBeginsWith) {
        if (oldWithoutStar === entrypointToReplace) {
          starMatches.push(item);
        } else {
          // If the entrypoint to replace does not match the import map entry exactly
          // take off the last item in the path and check that. This is because we
          // never nest entrypoints more than once.
          const lastSlashIndex = entrypointToReplace.lastIndexOf("/");
          const toReplaceWithoutLastPath = entrypointToReplace.slice(
            0,
            lastSlashIndex
          );
          if (toReplaceWithoutLastPath === oldWithoutStar) {
            starMatches.push(item);
          }
        }
      }
      const doesMatchExactly =
        entrypointToReplace === item.old.replace("/*", "");
      if (doesMatchExactly) {
        starMatches.push(item);
      }
    } else if (item.old === entrypointToReplace) {
      exactEntrypoints.push(item);
    }
  });

  if (exactEntrypoints.length) {
    return {
      newEntrypoint: exactEntrypoints[0].new,
      symbols: null,
      isStarMatch: false,
    };
  } else if (starMatches.length) {
    return {
      newEntrypoint: starMatches[0].new,
      symbols: starMatches
        .map((item) => item.symbol)
        .filter((s): s is string => s !== null),
      isStarMatch: true,
    };
  }
  return null;
}

/**
 * Migrates a project's LangChain imports from version 0.0.x or 0.1.x to 0.2.x.
 * This function updates the import statements in the specified project files
 * based on the provided import map.
 *
 * @param {UpdateLangChainFields} fields - The configuration object for the migration.
 * @param {string} [fields.projectPath] - The path to the project to check. TypeScript files will be extracted
 *   via this glob pattern: `${projectPath}/{star-star}/{star}.{ts,tsx,js,jsx}`. Not required if `files` or `tsConfigPath` is provided.
 * @param {string[]} [fields.files] - A list of .ts file paths to check. Not required if `projectPath` or `tsConfigPath` is provided.
 * @param {string} [fields.tsConfigPath] - Path to the tsConfig file. This will be used to load
 *   all the project files into the script. Not required if `projectPath` or `files` is provided.
 * @param {boolean} [fields.shouldLog=false] - Whether or not to log a message when an import is updated.
 * @returns {Promise<Array<MigrationUpdate> | null>} - A promise that resolves to an array of migration updates if successful, or null if an error occurs.
 * @throws {Error} - If more than one of `projectPath`, `tsConfigPath`, or `files` is provided, or if none of them are provided.
 *
 * @example
 * ```typescript
 * import { updateEntrypointsFrom0_x_xTo0_2_x } from "@langchain/scripts/migrations";
 *
 * const pathToMyProject = "...";
 *
 * updateEntrypointsFrom0_x_xTo0_2_x({
 *   projectPath: pathToMyProject,
 *   shouldLog: true,
 * });
 * ```
 */
export async function updateEntrypointsFrom0_x_xTo0_2_x(
  fields: UpdateLangChainFields
): Promise<Array<MigrationUpdate> | null> {
  if (
    fields.projectPath &&
    fields.files &&
    fields.files.length > 0 &&
    fields.tsConfigPath
  ) {
    throw new Error(
      "Only one of `projectPath`, `tsConfigPath`, or `files` can be provided."
    );
  }
  if (
    !fields.projectPath &&
    (!fields.files || fields.files.length === 0) &&
    !fields.tsConfigPath
  ) {
    throw new Error(
      "One of `projectPath`, `tsConfigPath`, or `files` must be provided."
    );
  }

  const importMap: Array<DeprecatedEntrypoint> = JSON.parse(
    fs.readFileSync("importMap.json", "utf-8")
  );

  let projectFiles: string[] | null = null;
  if (fields.projectPath) {
    projectFiles = glob.sync(
      path.join(fields.projectPath, "/**/*.{ts,tsx,js,jsx}")
    );
  } else if (fields.files) {
    projectFiles = fields.files;
  }

  // Instantiate tsMorph project
  const project = new Project({
    tsConfigFilePath: fields.tsConfigPath,
  });

  if (projectFiles) {
    project.addSourceFilesAtPaths(projectFiles);
  }

  const updates: Array<MigrationUpdate> = [];

  // Iterate over every file and check imports
  project.getSourceFiles().forEach((sourceFile) => {
    try {
      const allImports = sourceFile.getImportDeclarations();
      allImports.forEach((importDeclaration) => {
        const namedImports = importDeclaration.getNamedImports();
        if (namedImports.length === 0) {
          // no-op
          return;
        }
        if (
          namedImports.length === 1 &&
          DEPRECATED_AND_DELETED_IMPORTS.find(
            (dep) => dep === namedImports[0].getText().trim()
          ) !== undefined
        ) {
          // deprecated import, do not update
          return;
        }

        const importPath = importDeclaration.getModuleSpecifierValue();
        const importPathText = importDeclaration.getModuleSpecifier().getText();
        const importPathTextWithoutQuotes = importPathText.slice(
          1,
          importPathText.length - 1
        );

        const matchingEntrypoint = findNewEntrypoint(
          importMap,
          importPathTextWithoutQuotes
        );
        if (matchingEntrypoint === null) {
          // no-op
          return;
        }

        // If it's not a star match, or a star match where there are no symbols
        // just re-write the import with the new entrypoint
        if (
          !matchingEntrypoint.isStarMatch ||
          !matchingEntrypoint.symbols ||
          matchingEntrypoint.symbols.length === 0
        ) {
          importDeclaration.setModuleSpecifier(
            matchingEntrypoint.newEntrypoint
          );
        } else {
          const namedImports = importDeclaration.getNamedImports();
          if (namedImports.length === 0) {
            return;
          }
          const matchingNamedImports = namedImports.filter((namedImport) => {
            const namedImportText = namedImport.getText().trim();
            const matchingSymbol = matchingEntrypoint.symbols?.find(
              (s) => s === namedImportText
            );
            if (matchingSymbol) {
              return true;
            }
            return false;
          });
          if (!matchingNamedImports || matchingNamedImports.length === 0) {
            // No symbols matched, no-op
            return;
          }
          // remove matchingNamedImports from the existing import
          matchingNamedImports.forEach((namedImport) => {
            namedImport.remove();
          });
          // write a new import with the new entrypoint
          sourceFile.addImportDeclaration({
            moduleSpecifier: matchingEntrypoint.newEntrypoint,
            namedImports: matchingNamedImports.map((namedImport) =>
              namedImport.getText()
            ),
          });
        }

        // Update import
        // now get the full updated import
        const filePath = sourceFile.getFilePath();
        if (fields.shouldLog) {
          console.log(
            `Updated import: ${importPath} to ${matchingEntrypoint.newEntrypoint} inside ${filePath}`
          );
        }
        updates.push({
          path: filePath,
          oldImport: importPathTextWithoutQuotes,
          updatedImport: matchingEntrypoint.newEntrypoint,
        });
      });
    } catch (e) {
      console.error(
        {
          path: sourceFile.getFilePath(),
          error: e,
        },
        "Error updating imports."
      );
    }
  });

  // save changes
  try {
    if (!fields.testRun) {
      await project.save();
    }
    return updates;
  } catch (e) {
    console.error(
      {
        error: e,
      },
      "Error saving changes."
    );
    return null;
  }
}
