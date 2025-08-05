const fs = require("fs");

const communityPackageJsonPath = "package.json";
const currentPackageJson = JSON.parse(
  fs.readFileSync(communityPackageJsonPath)
);

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

if (currentPackageJson.devDependencies?.["@langchain/core"]) {
  delete currentPackageJson.devDependencies["@langchain/core"];
  currentPackageJson.peerDependencies["@langchain/core"] = "*";
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
