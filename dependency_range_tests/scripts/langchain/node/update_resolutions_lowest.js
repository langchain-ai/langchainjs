const fs = require("fs");

const WORKSPACE_ROOT = "/libs";
const PROVIDERS_ROOT = `${WORKSPACE_ROOT}/providers`;
const COMMUNITY_ROOT = `${WORKSPACE_ROOT}/community`;
const INTERNAL_PACKAGES = ["@langchain/tsconfig"];

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

function getWorkspaceDependencies(packageJson) {
  return [
    ...Object.entries(packageJson.devDependencies ?? {}),
    ...Object.entries(packageJson.peerDependencies ?? {}),
    ...Object.entries(packageJson.dependencies ?? {}),
    ...Object.entries(packageJson.optionalDependencies ?? {}),
  ]
    .filter(([, depVersion]) => depVersion.includes("workspace:"))
    .map(([depName]) => depName);
}

function resolvePackagePath(depName) {
  if (INTERNAL_PACKAGES.includes(depName)) {
    const libName = depName.split("/")[1];
    return `/internal/${libName}`;
  }

  if (!depName.startsWith("@langchain/")) {
    return null;
  }

  const libName = depName.split("/")[1];
  return resolveWorkspacePath(libName);
}

const packageJsonPath = "package.json";
const currentPackageJson = JSON.parse(fs.readFileSync(packageJsonPath));
currentPackageJson.devDependencies ??= {};
currentPackageJson.pnpm ??= {};
currentPackageJson.pnpm.overrides ??= {};

/**
 * Link workspace dependencies via file path.
 * Also recurse through linked local packages and hoist their workspace deps into
 * pnpm overrides so nested workspace:* references don't break in this partial workspace.
 */
const queue = getWorkspaceDependencies(currentPackageJson);
const visited = new Set();

while (queue.length) {
  const depName = queue.shift();
  if (!depName || visited.has(depName)) {
    continue;
  }
  visited.add(depName);

  const depPath = resolvePackagePath(depName);
  if (!depPath) {
    continue;
  }

  const depSpec = `file:${depPath}`;

  currentPackageJson.devDependencies[depName] = depSpec;
  currentPackageJson.pnpm.overrides[depName] = depSpec;

  if (INTERNAL_PACKAGES.includes(depName)) {
    continue;
  }

  const nestedPackageJsonPath = `${depPath}/package.json`;
  if (!fs.existsSync(nestedPackageJsonPath)) {
    continue;
  }

  const nestedPackageJson = JSON.parse(fs.readFileSync(nestedPackageJsonPath));
  const nestedWorkspaceDependencies = getWorkspaceDependencies(nestedPackageJson);
  queue.push(...nestedWorkspaceDependencies);
}

fs.writeFileSync(packageJsonPath, JSON.stringify(currentPackageJson, null, 2));
