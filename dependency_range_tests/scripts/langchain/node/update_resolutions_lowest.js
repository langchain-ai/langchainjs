const fs = require("fs");
const semver = require("semver");

const communityPackageJsonPath = "package.json";

const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);

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

// Convert workspace dependencies to peer dependencies since they don't exist in the test environment
if (currentPackageJson.devDependencies) {
  for (const [depName, depVersion] of Object.entries(
    currentPackageJson.devDependencies
  )) {
    if (depVersion.includes("workspace:")) {
      delete currentPackageJson.devDependencies[depName];
    }
  }
}

if (currentPackageJson.dependencies) {
  for (const [depName, depVersion] of Object.entries(
    currentPackageJson.dependencies
  )) {
    if (depVersion.includes("workspace:")) {
      // Convert workspace dependencies to peer dependencies
      if (!currentPackageJson.peerDependencies) {
        currentPackageJson.peerDependencies = {};
      }
      currentPackageJson.peerDependencies[depName] = "*";
      delete currentPackageJson.dependencies[depName];
    }
  }
}

if (
  currentPackageJson.peerDependencies?.["@langchain/openai"] &&
  !currentPackageJson.peerDependencies["@langchain/openai"].includes("rc") &&
  currentPackageJson.peerDependencies["@langchain/openai"] !== "*"
) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/openai"]
  ).version;
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/openai": minVersion,
  };
}

if (
  currentPackageJson.peerDependencies?.["@langchain/textsplitters"] &&
  !currentPackageJson.peerDependencies["@langchain/textsplitters"].includes(
    "rc"
  ) &&
  currentPackageJson.peerDependencies["@langchain/textsplitters"] !== "*"
) {
  const minVersion = semver.minVersion(
    currentPackageJson.peerDependencies["@langchain/textsplitters"]
  ).version;
  currentPackageJson.peerDependencies = {
    ...currentPackageJson.peerDependencies,
    "@langchain/textsplitters": minVersion,
  };
}

// Stupid hack
currentPackageJson.resolutions = {
  ...currentPackageJson.resolutions,
  jackspeak: "2.1.1",
};

fs.writeFileSync(
  communityPackageJsonPath,
  JSON.stringify(currentPackageJson, null, 2)
);
