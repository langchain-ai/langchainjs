const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "package.json";

const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);

if (
  currentPackageJson.peerDependencies["@langchain/core"] &&
  !currentPackageJson.peerDependencies["@langchain/core"].includes("rc")
) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/core"]
  ).version;
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/core": minVersion,
  };
}

if (currentPackageJson.devDependencies["@langchain/core"]) {
  delete currentPackageJson.devDependencies["@langchain/core"];
}

if (
  currentPackageJson.dependencies["@langchain/openai"] &&
  !currentPackageJson.dependencies["@langchain/openai"].includes("rc")
) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/openai"]
  ).version;
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/openai": minVersion,
  };
}

if (
  currentPackageJson.dependencies["@langchain/textsplitters"] &&
  !currentPackageJson.dependencies["@langchain/textsplitters"].includes("rc")
) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/textsplitters"]
  ).version;
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/textsplitters": minVersion,
  };
}

// Stupid hack
currentPackageJson.resolutions = {
  ...currentPackageJson.resolutions,
  jackspeak: "2.1.1",
};

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
