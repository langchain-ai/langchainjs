const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "package.json";

const currentPackageJson = JSON.parse(fs.readFileSync(communityPackageJsonPath));

if (currentPackageJson.dependencies["@langchain/core"] && !currentPackageJson.dependencies["@langchain/core"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/core"]
  ).version;
  currentPackageJson.overrides = {
    ...currentPackageJson.overrides,
    "@langchain/core": minVersion,
  };
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/core": minVersion,
  };
}

if (currentPackageJson.dependencies["@langchain/openai"] && !currentPackageJson.dependencies["@langchain/openai"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/openai"]
  ).version;
  currentPackageJson.overrides = {
    ...currentPackageJson.overrides,
    "@langchain/openai": minVersion,
  };
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/openai": minVersion,
  };
}

if (currentPackageJson.dependencies["@langchain/textsplitters"] && !currentPackageJson.dependencies["@langchain/textsplitters"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/textsplitters"]
  ).version;
  currentPackageJson.overrides = {
    ...currentPackageJson.overrides,
    "@langchain/textsplitters": minVersion,
  };
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/textsplitters": minVersion,
  };
}

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
