const fs = require("fs");

const WORKSPACE_ROOT = "/libs";
const PROVIDERS_ROOT = `${WORKSPACE_ROOT}/providers`;
const COMMUNITY_ROOT = `${WORKSPACE_ROOT}/community`;

function resolveWorkspacePath(libName) {
  const providerPath = `${PROVIDERS_ROOT}/langchain-${libName}`;
  if (fs.existsSync(providerPath)) {
    return providerPath;
  }

  const communityPath = `${COMMUNITY_ROOT}/langchain-${libName}`;
  if (fs.existsSync(communityPath)) {
    return communityPath;
  }

  return `${WORKSPACE_ROOT}/langchain-${libName}`;
}

const communityPackageJsonPath = "package.json";
const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);
currentPackageJson.pnpm = { overrides: {} };

const INTERNAL_PACKAGES = ["@langchain/tsconfig"];

/**
 * Link workspace dependencies via file path
 */
const workspaceDependencies = [
  ...Object.entries(currentPackageJson.devDependencies),
  ...Object.entries(currentPackageJson.peerDependencies),
  ...Object.entries(currentPackageJson.dependencies),
].filter(([, depVersion]) => depVersion.includes("workspace:"));

for (const [depName, depVersion] of workspaceDependencies) {
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
  currentPackageJson.devDependencies[depName] = `file:${resolveWorkspacePath(
    libName
  )}`;
  /**
   * ensure that peer dependencies are also installed from the file path
   * e.g. @langchain/openai depends on @langchain/core which should be resolved from the file path
   */
  currentPackageJson.pnpm.overrides[depName] = `file:${resolveWorkspacePath(
    libName
  )}`;
}

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
