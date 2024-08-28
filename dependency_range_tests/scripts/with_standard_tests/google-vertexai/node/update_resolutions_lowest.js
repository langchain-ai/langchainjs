const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "/app/monorepo/libs/langchain-google-vertexai/package.json";

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

if (currentPackageJson.dependencies["@langchain/google-gauth"] && !currentPackageJson.dependencies["@langchain/google-gauth"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/google-gauth"]
  ).version;
  currentPackageJson.overrides = {
    ...currentPackageJson.overrides,
    "@langchain/google-gauth": minVersion,
  };
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/google-gauth": minVersion,
  };
}

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
