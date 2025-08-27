const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "package.json";

const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);
currentPackageJson.pnpm = { overrides: {} };

if (
  currentPackageJson.peerDependencies?.["@langchain/core"] &&
  !currentPackageJson.peerDependencies["@langchain/core"].includes("rc")
) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/core"]
  ).version;
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/core": minVersion,
  };
}

/**
 * Convert workspace dev dependencies to install latest as they are only used for testing
 */
const workspaceDependencies = [
  ...Object.entries(currentPackageJson.devDependencies),
  ...Object.entries(currentPackageJson.dependencies),
].filter(([, depVersion]) => depVersion.includes("workspace:"));

for (const [depName, depVersion] of workspaceDependencies) {
  /**
   * for the peer dependency @langchain/core, we want to make sure to install min version
   * defined above
   */
  if (depName === "@langchain/core") {
    delete currentPackageJson.devDependencies[depName];
    continue;
  }

  const libName = depName.split("/")[1];
  /**
   * reference the workspace dependency as a file path
   */
  currentPackageJson.devDependencies[
    depName
  ] = `file:/libs/langchain-${libName}`;
  /**
   * ensure that peer dependencies are also installed from the file path
   * e.g. @langchain/openai depends on @langchain/core which should be resolved from the file path
   */
  currentPackageJson.pnpm.overrides[
    depName
  ] = `file:/libs/langchain-${libName}`;
}

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
