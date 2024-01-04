const fs = require("fs");
const semver = require("semver");

const currentPackageJson = JSON.parse(fs.readFileSync("./package.json"));

currentPackageJson.resolutions = {
  ...currentPackageJson.resolutions,
  "@langchain/core": currentPackageJson.dependencies["@langchain/core"]
};