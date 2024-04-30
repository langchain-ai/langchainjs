import { glob } from "glob";
import { Project } from "ts-morph";
import fs from "fs";
import path from "path";

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
}

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

/**
 * Edge cases to cover:
 * double exports
 * - tools
 * - memory
 * - schema
 * - agents (toolkits?)
 * - stores
 * - llms/fake
 * - prompts/load
 * - retrievers/remote
 * Moving all the @langchain/community/retrievers/self_query/x to @langchain/community/structured_query/x
 * 
 * 
 * 
 * importMap now contains `symbol: string | null`
 * if import map old path ends with `/*` then it can be any path after
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

  const importMap: Array<{ old: string; new: string }> = JSON.parse(
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
        const importPath = importDeclaration.getModuleSpecifierValue();
        const importPathText = importDeclaration.getModuleSpecifier().getText();
        const importPathTextWithoutQuotes = importPathText.slice(
          1,
          importPathText.length - 1
        );

        const deprecatedEntrypoint = importMap.find(
          (entrypoint) => entrypoint.old === importPathTextWithoutQuotes
        );
        if (!deprecatedEntrypoint) {
          // no-op
          return;
        }
        // Update import
        importDeclaration.setModuleSpecifier(deprecatedEntrypoint.new);
        // now get the full updated import
        const filePath = sourceFile.getFilePath();
        if (fields.shouldLog) {
          console.log(
            `Updated import: ${importPath} to ${deprecatedEntrypoint.new} inside ${filePath}`
          );
        }
        updates.push({
          path: filePath,
          oldImport: importPathTextWithoutQuotes,
          updatedImport: deprecatedEntrypoint.new,
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
    await project.save();
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
