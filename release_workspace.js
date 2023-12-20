const { execSync, exec } = require('child_process');
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

/**
 * @param {string} version 
 * @returns {string} The new version
 */
function bumpVersion(version) {
  let parts = version.split('.');
  
  parts[parts.length - 1] = parseInt(parts[parts.length - 1], 10) + 1;
  return parts.join('.');
}

/**
 * @param {Array<string>} workspaces 
 * @param {"dependencies" | "devDependencies" | "peerDependencies"} dependencyType 
 * @param {string} workspaceName 
 * @param {string} newVersion 
 */
function updateDependencies(workspaces, dependencyType, workspaceName, newVersion) {
  const versionPrefixes = ["~", "^", ">", "<", ">=", "<=", "||", "*"];
  const skipVersions = ["latest", "workspace:*"];

  workspaces.forEach((workspace) => {
    const currentVersion = workspace.packageJSON[dependencyType]?.[workspaceName];
    if (currentVersion) {
      const prefix = versionPrefixes.find((p) => currentVersion.startsWith(p));
      const shouldSkip = skipVersions.some((v) => currentVersion.includes(v));

      if (!shouldSkip) {
        const versionToUpdate = prefix ? `${prefix}${newVersion}` : newVersion;
        workspace.packageJSON[dependencyType][workspaceName] = versionToUpdate;
        fs.writeFileSync(path.join(workspace.dir, "package.json"), JSON.stringify(workspace.packageJSON, null, 2) + '\n');
      }
    }
  });
}

function main() {
  const program = new Command();
  program
    .description("Release a new workspace version to NPM.")
    .option("--workspace <workspace>", "Workspace name, eg @langchain/core")
    .option("--version <version>", "Optionally override the version to bump to.")
    .option("--bump-deps", "Whether or not to bump other workspaces that depend on this one.");

  program.parse();

  const options = program.opts();
  console.log(options);

  // Find the workspace package.json's.
  const possibleWorkspaceDirectories = ["./libs/*", "./langchain", "./langchain-core"];
  const allWorkspaces = possibleWorkspaceDirectories.flatMap((workspaceDirectory) => {
    if (workspaceDirectory.endsWith("*")) {
      // List all folders inside directory, require, and return the package.json.
      const allDirs = fs.readdirSync(path.join(process.cwd(), workspaceDirectory.replace("*", "")));
      const subDirs = allDirs.map((dir) => {
        return {
          dir: `${workspaceDirectory.replace("*", "")}${dir}`,
          packageJSON: require(path.join(process.cwd(), `${workspaceDirectory.replace("*", "")}${dir}`, "package.json"))
        }
      });
      return subDirs;
    }
    const packageJSON = require(path.join(process.cwd(), workspaceDirectory, "package.json"));
    return {
      dir: workspaceDirectory,
      packageJSON,
    };
  });

  const matchingWorkspace = allWorkspaces.find(({ packageJSON }) => packageJSON.name === options.workspace);
  
  if (!matchingWorkspace) {
    throw new Error(`Could not find workspace ${options.workspace}`);
  }

  // Bump version by 1 or use the version passed in.
  const newVersion = options.version ?? bumpVersion(matchingWorkspace.packageJSON.version);
  console.log(`Running "release-it". Bumping version of ${options.workspace} to ${newVersion}`);

  // checkout new "release" branch & push
  const currentBranch = execSync('git branch --show-current').toString().trim();
  // @TODO change to main before merging
  if (currentBranch === 'brace/better-releases') {
    console.log("success")
    execSync('git checkout -B brace/release');
    execSync('git push -u origin brace/release');
  } else {
    throw new Error(`Current branch is not main. Current branch: ${currentBranch}`);
  }

  // run build, lint, tests
  execSync(`yarn turbo:command run --filter ${options.workspace} build lint test --concurrency 1`);
  // run export tests
  execSync(`yarn run test:exports:docker`);
  // run `release-it` on workspace
  execSync(`cd ${matchingWorkspace.dir} && yarn release`);
  // Log release branch URL
  console.log("🔗 Open https://github.com/langchain-ai/langchainjs/compare/release?expand=1 and merge the release PR.")

  // If `bump-deps` flag is set, find all workspaces which depend on the input workspace.
  // Then, update their package.json to use the new version of the input workspace.
  // This will create a new branch, commit and push the changes and log the branch URL.
  if (options.bumpDeps) {
    console.log(`Bumping other packages which depend on ${options.workspace}.`);
    console.log("Checking out main branch.");
    // execSync(`git checkout main`);
    console.log("Stashing any changes.");
    // execSync(`git stash`);
    const newBranchName = `bump-${options.workspace}-to-${newVersion}`;
    console.log(`Checking out new branch: ${newBranchName}`);
    // execSync(`git checkout -b ${newBranchName}`);

    const allWorkspacesWhichDependOn = allWorkspaces.filter(({ packageJSON }) => 
      Object.keys(packageJSON.dependencies ?? {}).includes(options.workspace)
    );
    const allWorkspacesWhichDevDependOn = allWorkspaces.filter(({ packageJSON }) => 
      Object.keys(packageJSON.devDependencies ?? {}).includes(options.workspace)
    );
    const allWorkspacesWhichPeerDependOn = allWorkspaces.filter(({ packageJSON }) =>
      Object.keys(packageJSON.peerDependencies ?? {}).includes(options.workspace)
    );

    // For console log, get all workspaces which depend and filter out duplicates.
    const allWhichDependOn = new Set([
      ...allWorkspacesWhichDependOn,
      ...allWorkspacesWhichDevDependOn,
      ...allWorkspacesWhichPeerDependOn,
    ].map(({ packageJSON }) => packageJSON.name));

    if (allWhichDependOn.size !== 0) {
      console.log(`Found ${[...allWhichDependOn]} workspaces which depend on ${options.workspace}.
Workspaces:
- ${[...allWhichDependOn].map((name) => name).join("\n- ")}
`);
      // Update packages which depend on the input workspace.
      updateDependencies(allWorkspacesWhichDependOn, 'dependencies', options.workspace, newVersion);
      updateDependencies(allWorkspacesWhichDevDependOn, 'devDependencies', options.workspace, newVersion);
      updateDependencies(allWorkspacesWhichPeerDependOn, 'peerDependencies', options.workspace, newVersion);

      // Add all current changes, commit, push and log branch URL.
      console.log("Adding and committing all changes.");
      // execSync(`git add -A`);
      // execSync(`git commit -m "all[minor]: bump deps on ${options.workspace} to ${newVersion}"`);
      console.log("Pushing changes.");
      // execSync(`git push -u origin ${newBranchName}`);
      console.log(`🔗 Open https://github.com/langchain-ai/langchainjs/compare/${newBranchName}?expand=1.`);
    } else {
      console.log(`No workspaces depend on ${options.workspace}.`);
    }
  }
}

main()