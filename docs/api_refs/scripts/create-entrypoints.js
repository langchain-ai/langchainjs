const { Project, SyntaxKind } = require("ts-morph");
const fs = require("fs");
const path = require("path");

/**
 *
 * @param {string} relativePath
 * @param {any} updateFunction
 */
const updateJsonFile = (relativePath, updateFunction) => {
  const contents = fs.readFileSync(relativePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(relativePath, JSON.stringify(res, null, 2) + "\n");
};

function main() {
  const project = new Project();
  const workspaces = fs
  .readdirSync("../../libs/")
  .filter((dir) => dir.startsWith("langchain-"))
  .map((dir) => path.join("../../libs/", dir, "/scripts/create-entrypoints.js"));
  const entrypointFiles = [
    "../../langchain/scripts/create-entrypoints.js",
    "../../langchain-core/scripts/create-entrypoints.js",
    ...workspaces,
  ];

  const entrypoints = new Set([]);
  entrypointFiles.forEach((entrypointFile) => {
    // load file contents from ts-morph
    const file = project.addSourceFileAtPath(entrypointFile);
    // extract the variable named entrypoints
    const entrypointVar = file.getVariableDeclarationOrThrow("entrypoints");
    // extract the `deprecatedNodeOnly` if it exists
    const deprecatedNodeOnlyVar =
      file.getVariableDeclaration("deprecatedNodeOnly");
    /**
     * @type {string[]}
     */
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

    /**
     * @type {Record<string, string>}
     */
    const entrypointsObject = Object.fromEntries(entrypointKeysArray);
    const entrypointDir = entrypointFile.split(
      "/scripts/create-entrypoints.js"
    )[0];

    Object.values(entrypointsObject)
      .filter((key) => !deprecatedNodeOnly.includes(key))
      .map((key) => entrypoints.add(`${entrypointDir}/src/${key}.ts`));
  });

  updateJsonFile("./typedoc.json", (json) => ({
    ...json,
    entryPoints: Array.from(entrypoints),
  }));
}
main();
