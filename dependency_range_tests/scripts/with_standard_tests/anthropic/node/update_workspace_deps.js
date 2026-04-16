const fs = require("fs");

const packageJsonPath =
  "/app/monorepo/libs/providers/langchain-anthropic/package.json";
const currentPackageJson = JSON.parse(
  fs.readFileSync(packageJsonPath)
);

fs.writeFileSync(
  packageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
