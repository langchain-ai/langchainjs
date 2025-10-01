const fs = require("fs");

const communityPackageJsonPath =
  "/app/monorepo/libs/providers/langchain-openai/package.json";
const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);

if (currentPackageJson.devDependencies["@langchain/core"]) {
  delete currentPackageJson.devDependencies["@langchain/core"];
  const peerDependencyVersion =
    currentPackageJson.peerDependencies["@langchain/core"] ?? "*";
  currentPackageJson.peerDependencies["@langchain/core"] =
    peerDependencyVersion;
}

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
