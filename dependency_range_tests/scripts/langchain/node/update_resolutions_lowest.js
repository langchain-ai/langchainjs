const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "package.json";

const INTERNAL_PACKAGES = ["@langchain/eslint"];

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

  // Check if the minimum version matches the workspace version
  const corePackageJsonPath = "/app/libs/langchain-core/package.json";
  const corePackageJson = JSON.parse(fs.readFileSync(corePackageJsonPath));

  if (corePackageJson.version === minVersion) {
    // Link workspace version if it matches the minimum version
    currentPackageJson.peerDependencies = {
      ...currentPackageJson.peerDependencies,
      "@langchain/core": `file:/libs/langchain-core`,
    };
    currentPackageJson.pnpm.overrides[
      "@langchain/core"
    ] = `file:/libs/langchain-core`;
  } else {
    currentPackageJson.peerDependencies = {
      ...currentPackageJson.peerDependencies,
      "@langchain/core": minVersion,
    };
  }
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

  if (INTERNAL_PACKAGES.includes(depName)) {
    /**
     * reference the workspace dependency as a file path
     */
    currentPackageJson.devDependencies[depName] = `file:/internal/${libName}`;
    continue;
  }

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
