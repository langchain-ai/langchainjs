const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "/app/monorepo/libs/langchain-anthropic/package.json";

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

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
