const { Project, SyntaxKind } = require("ts-morph");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
/**
 * Find all lc core & lc community entrypoints that are duplicated in LC
 * Use ts-morph to get all exported symbols from each entrypoint
 * If all symbols are duplicated, then the entrypoint is blacklisted,
 * push that entrypoint to the blacklist
 */

/**
 * @param {string} entrypointFile 
 * @param {Project} project
 * @returns {Array<{ entrypoint: string, exportedSymbols: Array<string> }>}
 */
function getEntrypointsFromFile(entrypointFile, project) {
  /** @type {Set<string>} */
  const entrypoints = new Set();
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

/**
 * 
 * @param {Array<string>} array1 
 * @param {Array<string>} array2 
 */
function checkArraysAreIdentical(array1, array2) {
  if (array1.length !== array2.length) {
    return false;
  }

  return array1.every((item) => array2.find((arrItem2) => arrItem2 === item));
}

/**
 * These are all entrypoints where the entrypoint changed
 * when migrated from lc proper to a lib, but all the exports
 *  are the same.
 * 
 * @param {{ langchainEntry: string, libEntry: string, lib: "core" | "community" }} bruhMoment 
 */
function logBruhMomentEntrypoints(bruhMoment) {
  const bruhMomentFileContents = JSON.parse(fsSync.readFileSync("./bruh-moment-entrypoints.json", "utf-8"));
  bruhMomentFileContents.push(bruhMoment)
  fsSync.writeFileSync("./bruh-moment-entrypoints.json", JSON.stringify(bruhMomentFileContents));
}

async function main() {
  /** @type {Project} */
  const project = new Project();

  /** @type {Set<string>} */
  const langchainEntrypointBlacklist = new Set()

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainEntrypoints = getEntrypointsFromFile("../../langchain/scripts/create-entrypoints.js", project);
  console.log("langchainEntrypoints.length", langchainEntrypoints.length);

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainCoreEntrypoints = getEntrypointsFromFile("../../langchain-core/scripts/create-entrypoints.js", project);
  console.log("langchainCoreEntrypoints.length", langchainCoreEntrypoints.length);

  /** @type {Array<{ entrypoint: string, exportedSymbols: Array<string> }>} */
  const langchainCommunityEntrypoints = getEntrypointsFromFile("../../libs/langchain-community/scripts/create-entrypoints.js", project);
  console.log("langchainCommunityEntrypoints.length", langchainCommunityEntrypoints.length);

  langchainEntrypoints.forEach(({ entrypoint, exportedSymbols }) => {
    if (langchainCoreEntrypoints.find((coreItem) => {
      if (coreItem.entrypoint !== entrypoint) {
        if (checkArraysAreIdentical(coreItem.exportedSymbols, exportedSymbols)) {
          logBruhMomentEntrypoints({
            langchainEntry: entrypoint,
            libEntry: coreItem.entrypoint,
            lib: "core",
          });
        }
        return false;
      }
      if (checkArraysAreIdentical(coreItem.exportedSymbols, exportedSymbols)) {
        return true;
      }
      return false;
    })) {
      langchainEntrypointBlacklist.add(entrypoint);
    }

    if (langchainCommunityEntrypoints.find((communityItem) => {
      if (communityItem.entrypoint !== entrypoint) {
        if (checkArraysAreIdentical(communityItem.exportedSymbols, exportedSymbols)) {
          logBruhMomentEntrypoints({
            langchainEntry: entrypoint,
            libEntry: communityItem.entrypoint,
            lib: "community",
          });
        }
        return false;
      }
      if (checkArraysAreIdentical(communityItem.exportedSymbols, exportedSymbols)) {
        return true;
      }
      return false;
    })) {
      langchainEntrypointBlacklist.add(entrypoint);
    }
  });

  console.log([...langchainEntrypointBlacklist].length);

  /** @type {Array<string>} */
  const blackListAsStringArray = [...langchainEntrypointBlacklist].map((entrypoint) => path.join("..", "..", "langchain", "src", `${entrypoint}.ts`));
  await fs.writeFile("./blacklisted-entrypoints.json", JSON.stringify(blackListAsStringArray));
}

main();