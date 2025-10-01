const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath =
  "/app/monorepo/libs/providers/langchain-anthropic/package.json";

const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);

const isPrerelease = ["rc", "alpha"].includes(
  currentPackageJson.peerDependencies["@langchain/core"]
);

if (currentPackageJson.peerDependencies?.["@langchain/core"] && !isPrerelease) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/core"]
  ).version;
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/core": minVersion,
  };
}

if (currentPackageJson.devDependencies?.["@langchain/core"]) {
  delete currentPackageJson.devDependencies["@langchain/core"];
}

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
