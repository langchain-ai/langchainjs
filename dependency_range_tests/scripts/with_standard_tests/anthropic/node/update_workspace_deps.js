const fs = require("fs");

const communityPackageJsonPath = "/app/monorepo/libs/langchain-anthropic/package.json";
const currentPackageJson = JSON.parse(fs.readFileSync(communityPackageJsonPath));

// Anthropic has other workspaces as devDependencies, but tagged as `workspace:*` for the version.
// Update these to be `latest` for the test.
if (currentPackageJson.devDependencies["@langchain/community"]) {
  currentPackageJson.devDependencies = {
    ...currentPackageJson.devDependencies,
    "@langchain/community": "latest",
  };
}

fs.writeFileSync(communityPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));
