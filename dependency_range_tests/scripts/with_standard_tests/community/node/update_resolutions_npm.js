const fs = require("fs");

const communityPackageJsonPath = "/app/monorepo/libs/langchain-community/package.json";
const currentPackageJson = JSON.parse(fs.readFileSync(communityPackageJsonPath));

if (currentPackageJson.devDependencies["@langchain/core"]) {
  delete currentPackageJson.devDependencies["@langchain/core"];
}

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
