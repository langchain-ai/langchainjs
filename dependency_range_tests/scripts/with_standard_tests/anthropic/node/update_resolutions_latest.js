const fs = require("fs");

const communityPackageJsonPath =
  "/app/monorepo/libs/providers/langchain-anthropic/package.json";
const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);

if (currentPackageJson.devDependencies["@langchain/core"]) {
  delete currentPackageJson.devDependencies["@langchain/core"];
  currentPackageJson.peerDependencies["@langchain/core"] = "*";
}

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
