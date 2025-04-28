import { glob } from "glob";
import { ImportSpecifier, Project } from "ts-morph";
import path from "node:path";
import {
  type DeprecatedEntrypoint,
  importMap as importMapArr,
} from "../_data/importMap.js";

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

/**
 * Find the entrypoint in the import map that matches the
 * old entrypoint and named imports.
 */
function findNewEntrypoint(
  importMap: Array<DeprecatedEntrypoint>,
  entrypointToReplace: string,
  namedImports: ImportSpecifier[]
): {
  newEntrypoint: string;
  namedImports: string[] | null;
} | null {
  // First, see if we can find an exact match
  const exactEntrypoints = importMap.filter((item) => {
    if (item.old === entrypointToReplace) {
      return true;
    }
    if (item.old.endsWith("/*")) {
      const oldWithoutStar = item.old.replace("/*", "");
      if (entrypointToReplace.startsWith(oldWithoutStar)) {
        return true;
      }
    }
    return false;
  });

  if (exactEntrypoints.length) {
    const withNamedImport = exactEntrypoints.find((item) => {
      if (item.namedImport === null) {
        return true;
      }
      return (
        namedImports.find(
          (namedImport) => namedImport.getName() === item.namedImport
        ) !== undefined
      );
    });
    if (withNamedImport) {
      return {
        newEntrypoint: withNamedImport.new,
        namedImports: null,
      };
    }
  }

  // if we can not find an exact match, see if we can find a named import match
  const namedImportMatch = importMap.filter((item) => {
    if (item.namedImport === null) {
      return false;
    }
    return (
      namedImports.find(
        (namedImport) => namedImport.getName() === item.namedImport
      ) !== undefined
    );
  });
  if (namedImportMatch.length) {
    return {
      newEntrypoint: namedImportMatch[0].new,
      namedImports: namedImportMatch
        .map((item) => item.namedImport)
        .filter((i): i is string => i !== null),
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
      const filePath = sourceFile.getFilePath();

      allImports.forEach((importDeclaration) => {
        const namedImports = importDeclaration.getNamedImports();
        if (namedImports.length === 0) {
          // no-op
          return;
        }
        if (
          namedImports.length === 1 &&
          DEPRECATED_AND_DELETED_IMPORTS.find(
            (dep) => dep === namedImports[0].getName()
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

        if (!importPathTextWithoutQuotes.startsWith("langchain/")) {
          if (
            importPathTextWithoutQuotes !==
            "@langchain/community/retrievers/self_query/qdrant"
          ) {
            return;
          }
        }

        const matchingEntrypoint = findNewEntrypoint(
          importMapArr,
          importPathTextWithoutQuotes,
          namedImports
        );
        if (matchingEntrypoint === null) {
          // no-op
          return;
        }

        if (matchingEntrypoint.namedImports?.length) {
          const importsBefore = namedImports;
          const importsRemoved: Array<string> = [];
          namedImports.forEach((namedImport) => {
            const namedImportText = namedImport.getName();
            if (
              matchingEntrypoint.namedImports?.find(
                (s) => s === namedImportText
              )
            ) {
              importsRemoved.push(namedImportText);
              namedImport.remove();
            }
          });
          if (importsBefore.length === importsRemoved.length) {
            // all named imports were removed, delete the old import
            importDeclaration.remove();
          }
          // Create a new import with the proper named imports
          sourceFile.addImportDeclaration({
            moduleSpecifier: matchingEntrypoint.newEntrypoint,
            namedImports: importsRemoved,
          });
        } else {
          importDeclaration.setModuleSpecifier(
            matchingEntrypoint.newEntrypoint
          );
        }

        // Update import
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
