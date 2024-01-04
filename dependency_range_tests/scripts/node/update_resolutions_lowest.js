const fs = require("fs");
const semver = require("semver");

const currentPackageJson = JSON.parse(fs.readFileSync("./package.json"));

if (currentPackageJson.dependencies["@langchain/core"]) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/core"]
  ).version;
  currentPackageJson.resolutions = {
    ...currentPackageJson.resolutions,
    "@langchain/core": minVersion,
  };
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/core": minVersion,
  };
}

if (currentPackageJson.dependencies["@langchain/community"]) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/community"]
  ).version;
  currentPackageJson.resolutions = {
    ...currentPackageJson.resolutions,
    "@langchain/community": minVersion,
  };
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/community": minVersion,
  };
}

fs.writeFileSync("./package.json", JSON.stringify(currentPackageJson, null, 2));
