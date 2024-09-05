const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "package.json";

const currentPackageJson = JSON.parse(fs.readFileSync(communityPackageJsonPath));

if (currentPackageJson.peerDependencies["@langchain/core"] && !currentPackageJson.peerDependencies["@langchain/core"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/core"]
  ).version;
  currentPackageJson.overrides = {
    ...currentPackageJson.overrides,
    "@langchain/core": minVersion,
  };
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/core": minVersion,
  };
}

if (currentPackageJson.peerDependencies["@langchain/openai"] && !currentPackageJson.peerDependencies["@langchain/openai"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/openai"]
  ).version;
  currentPackageJson.overrides = {
    ...currentPackageJson.overrides,
    "@langchain/openai": minVersion,
  };
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/openai": minVersion,
  };
}

if (currentPackageJson.peerDependencies["@langchain/textsplitters"] && !currentPackageJson.peerDependencies["@langchain/textsplitters"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/textsplitters"]
  ).version;
  currentPackageJson.overrides = {
    ...currentPackageJson.overrides,
    "@langchain/textsplitters": minVersion,
  };
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/textsplitters": minVersion,
  };
}

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
