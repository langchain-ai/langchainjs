const fs = require("fs");

const communityPackageJsonPath = "/app/monorepo/libs/langchain-community/package.json";
const currentPackageJson = JSON.parse(fs.readFileSync(communityPackageJsonPath));

if (currentPackageJson.devDependencies) {
  delete currentPackageJson.devDependencies;
}

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
