import { Project, SyntaxKind } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

const PATH_TO_COMMUNITY_ENTRYPOINTS =
  "../../libs/langchain-community/scripts/create-entrypoints.js";
const PATH_TO_EXAMPLES = "../../examples/src";

function getCommunityEntrypoints() {
  const project = new Project();

  const entrypoints: string[] = [];

  // load file contents from ts-morph
  const file = project.addSourceFileAtPath(PATH_TO_COMMUNITY_ENTRYPOINTS);
  // extract the variable named entrypoints
  const entrypointVar = file.getVariableDeclarationOrThrow("entrypoints");
  // extract the `deprecatedNodeOnly` if it exists
  const deprecatedNodeOnlyVar =
    file.getVariableDeclaration("deprecatedNodeOnly");
  /**
   * @type {string[]}
   */
  let deprecatedNodeOnly: string[] = [];
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

  /**
   * @type {Record<string, string>}
   */
  const entrypointsObject = Object.fromEntries(entrypointKeysArray);
  const entrypointDir = PATH_TO_COMMUNITY_ENTRYPOINTS.split(
    "/scripts/create-entrypoints.js"
  )[0];

  Object.keys(entrypointsObject)
    .filter((key) => !deprecatedNodeOnly.includes(key as string))
    .map((key) => entrypoints.push(`langchain/${key}`));

  return entrypoints;
}

function main() {
  const entrypoints = getCommunityEntrypoints();
  const pathToAllFiles: string[] = [];
  const getAllFilesInDir = (dir: string) => {
    const allContentsOfDir = fs.readdirSync(dir);
    allContentsOfDir.forEach((item) => {
      if (item.endsWith(".ts")) {
        pathToAllFiles.push(path.join(dir, item));
      } else if (fs.lstatSync(path.join(dir, item)).isDirectory()) {
        getAllFilesInDir(path.join(dir, item));
      }
    });
  };
  getAllFilesInDir(PATH_TO_EXAMPLES);
  let foundCount = 0;
  pathToAllFiles.forEach((filePath) => {
    const filePathContents = fs.readFileSync(filePath, "utf-8");
    entrypoints.forEach((entrypoint) => {
      const oldImport = `from "${entrypoint}"`;
      const newImport = `from "${entrypoint.replace(
        "langchain/",
        "@langchain/community/"
      )}"`;
      if (filePathContents.includes(oldImport)) {
        console.log(`Replacing ${oldImport} with ${newImport}`);
        foundCount += 1;
        // const newFileContents = filePathContents.replaceAll(
        //   `from "${entrypoint}"`,
        //   `from "@langchain/${entrypoint}"`
        // );
        // fs.writeFileSync(filePath, newFileContents, "utf-8");
      }
    });
  });
  console.log(`Found ${foundCount} instances of community imports`);
}
main();
