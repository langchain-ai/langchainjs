const fs = require("fs");
const semver = require("semver");

const currentPackageJson = JSON.parse(fs.readFileSync("./package.json"));

if (currentPackageJson.dependencies["@langchain/core"] && !currentPackageJson.dependencies["@langchain/core"].includes("rc")) {
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

if (currentPackageJson.dependencies["@langchain/openai"] && !currentPackageJson.dependencies["@langchain/openai"].includes("rc")) {
  const minVersion = semver.minVersion(
    currentPackageJson.dependencies["@langchain/openai"]
  ).version;
  currentPackageJson.resolutions = {
    ...currentPackageJson.resolutions,
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
  currentPackageJson.resolutions = {
    ...currentPackageJson.resolutions,
    "@langchain/textsplitters": minVersion,
  };
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/textsplitters": minVersion,
  };
}

fs.writeFileSync("./package.json", JSON.stringify(currentPackageJson, null, 2));
