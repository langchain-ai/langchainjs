const fs = require("fs");

const communityPackageJsonPath =
  "/app/monorepo/libs/langchain-community/package.json";
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

if (currentPackageJson.dependencies["@langchain/openai"]) {
  delete currentPackageJson.dependencies["@langchain/openai"];
  currentPackageJson.dependencies["@langchain/openai"] = "latest";
}

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
