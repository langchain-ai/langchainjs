const fs = require("fs");

const communityPackageJsonPath = "/app/monorepo/libs/langchain-community/package.json";
const currentPackageJson = JSON.parse(fs.readFileSync(communityPackageJsonPath));

if (currentPackageJson.devDependencies["@langchain/core"]) {
  delete currentPackageJson.devDependencies["@langchain/core"];
  currentPackageJson.peerDependencies["@langchain/core"] = "latest";
}

if (currentPackageJson.devDependencies["@langchain/openai"]) {
  delete currentPackageJson.devDependencies["@langchain/openai"];
  currentPackageJson.peerDependencies["@langchain/openai"] = "latest";
}

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
