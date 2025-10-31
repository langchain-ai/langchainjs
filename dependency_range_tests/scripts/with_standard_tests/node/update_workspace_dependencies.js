const fs = require("fs");

const standardTestsPackageJsonPath =
  "/app/monorepo/libs/langchain-standard-tests/package.json";

const currentPackageJson = JSON.parse(
  fs.readFileSync(standardTestsPackageJsonPath)
);

if (currentPackageJson.dependencies["@langchain/core"]) {
  currentPackageJson.dependencies = {
    ...currentPackageJson.dependencies,
    "@langchain/core": "latest",
  };
}

fs.writeFileSync(
  standardTestsPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
