const { execSync } = require("child_process");
const { Command } = require("commander");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");
const semver = require('semver')

const PRIMARY_PROJECTS = ["langchain", "@langchain/core", "@langchain/community"];

/**
 * Finds all workspaces in the monorepo and returns an array of objects.
 * Each object in the return value contains the relative path to the workspace
 * directory, along with the full package.json file contents.
 * 
 * @returns {Array<{ dir: string, packageJSON: Record<string, any>}>}
 */
function getAllWorkspaces() {
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
  return allWorkspaces;
}

/**
 * Writes the JSON file with the updated dependency version. Accounts
 * for version prefixes, eg ~, ^, >, <, >=, <=, ||, *. Also skips
 * versions which are "latest" or "workspace:*".
 * 
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
      const shouldSkip = skipVersions.some((v) => currentVersion === v);

      if (!shouldSkip) {
        const versionToUpdate = prefix ? `${prefix}${newVersion}` : newVersion;
        workspace.packageJSON[dependencyType][workspaceName] = versionToUpdate;
        fs.writeFileSync(path.join(workspace.dir, "package.json"), JSON.stringify(workspace.packageJSON, null, 2) + "\n");
      }
    }
  });
}

/**
 * Runs `release-it` with args in the input package directory,
 * passing the new version as an argument, along with other
 * release-it args.
 * 
 * @param {string} packageDirectory The directory to run yarn release in.
 * @param {string} npm2FACode The 2FA code for NPM.
 * @param {string | undefined} tag An optional tag to publish to.
 * @returns {Promise<void>}
 */
async function runYarnRelease(packageDirectory, npm2FACode, tag) {
  return new Promise((resolve, reject) => {
    const workingDirectory = path.join(process.cwd(), packageDirectory);
    const tagArg = tag ? `--npm.tag=${tag}` : "";
    const args = ["release-it", "--only-version", `--npm.otp=${npm2FACode}`, tagArg, "--config", ".release-it.json"];
    
    console.log(`Running command: "yarn ${args.join(" ")}"`);

    const yarnReleaseProcess = spawn("yarn", args, { stdio: "inherit", cwd: workingDirectory });

    yarnReleaseProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`Process exited with code ${code}`);
      }
    });

    yarnReleaseProcess.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Finds all `package.json`'s which contain the input workspace as a dependency.
 * Then, updates the dependency to the new version, runs yarn install and
 * commits the changes.
 * 
 * @param {string} workspaceName The name of the workspace to bump dependencies for.
 * @param {string} workspaceDirectory The path to the workspace directory.
 * @param {Array<{ dir: string, packageJSON: Record<string, any>}>} allWorkspaces
 * @param {string | undefined} tag An optional tag to publish to.
 * @returns {void}
 */
function bumpDeps(workspaceName, workspaceDirectory, allWorkspaces, tag) {
  // Read workspace file, get version (edited by release-it), and bump pkgs to that version.
  const updatedWorkspaceVersion = require(path.join(process.cwd(), workspaceDirectory, "package.json")).version;
  if (!semver.valid(updatedWorkspaceVersion)) {
    console.error("Invalid workspace version: ", updatedWorkspaceVersion);
    process.exit(1);
  }

  console.log(`Bumping other packages which depend on ${workspaceName}.`);
  console.log("Checking out main branch.");

  // Separate variable for the branch name, incase it includes a tag.
  let versionString = updatedWorkspaceVersion;
  if (tag) {
    versionString = `${updatedWorkspaceVersion}-${tag}`;
  }

  execSync(`git checkout main`);
  const newBranchName = `bump-${workspaceName}-to-${versionString}`;
  console.log(`Checking out new branch: ${newBranchName}`);
  execSync(`git checkout -b ${newBranchName}`);

  const allWorkspacesWhichDependOn = allWorkspaces.filter(({ packageJSON }) => 
    Object.keys(packageJSON.dependencies ?? {}).includes(workspaceName)
  );
  const allWorkspacesWhichDevDependOn = allWorkspaces.filter(({ packageJSON }) => 
    Object.keys(packageJSON.devDependencies ?? {}).includes(workspaceName)
  );
  const allWorkspacesWhichPeerDependOn = allWorkspaces.filter(({ packageJSON }) =>
    Object.keys(packageJSON.peerDependencies ?? {}).includes(workspaceName)
  );

  // For console log, get all workspaces which depend and filter out duplicates.
  const allWhichDependOn = new Set([
    ...allWorkspacesWhichDependOn,
    ...allWorkspacesWhichDevDependOn,
    ...allWorkspacesWhichPeerDependOn,
  ].map(({ packageJSON }) => packageJSON.name));

  if (allWhichDependOn.size !== 0) {
    console.log(`Found ${[...allWhichDependOn].length} workspaces which depend on ${workspaceName}.
Workspaces:
- ${[...allWhichDependOn].map((name) => name).join("\n- ")}
`);
    // Update packages which depend on the input workspace.
    updateDependencies(allWorkspacesWhichDependOn, "dependencies", workspaceName, updatedWorkspaceVersion);
    updateDependencies(allWorkspacesWhichDevDependOn, "devDependencies", workspaceName, updatedWorkspaceVersion);
    updateDependencies(allWorkspacesWhichPeerDependOn, "peerDependencies", workspaceName, updatedWorkspaceVersion);
    console.log("Updated package.json's! Running yarn install.");

    try {
      execSync(`yarn install`);
    } catch (_) {
      console.log("Yarn install failed. Likely because NPM did not auto-publish the new version of the workspace. Continuing.")
    }

    // Add all current changes, commit, push and log branch URL.
    console.log("Adding and committing all changes.");
    execSync(`git add -A`);
    execSync(`git commit -m "all[minor]: bump deps on ${workspaceName} to ${versionString}"`);
    console.log("Pushing changes.");
    execSync(`git push -u origin ${newBranchName}`);
    console.log("🔗 Open %s and merge the release PR.", `\x1b[34mhttps://github.com/langchain-ai/langchainjs/compare/${newBranchName}?expand=1\x1b[0m`);
  } else {
    console.log(`No workspaces depend on ${workspaceName}.`);
  }
}

/**
 * Verifies the current branch is main, then checks out a new release branch
 * and pushes an empty commit.
 * 
 * @returns {void}
 * @throws {Error} If the current branch is not main.
 */
function checkoutReleaseBranch() {
  const currentBranch = execSync("git branch --show-current").toString().trim();
  if (currentBranch === "brace/release-script-qol") {
    console.log("Checking out 'release' branch.")
    execSync("git checkout -B release");
    execSync("git push -u origin release");
  } else {
    throw new Error(`Current branch is not main. Current branch: ${currentBranch}`);
  }
}

/**
 * Prompts the user for input and returns the input. This is used
 * for requesting an OTP from the user for NPM 2FA.
 * 
 * @param {string} question The question to log to the users terminal.
 * @returns {Promise<string>} The user input.
 */
async function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`\x1b[30m\x1b[47m${question}\x1b[0m`, (input) => {
      rl.close();
      resolve(input);
    });
  });
}


async function main() {
  const program = new Command();
  program
    .description("Release a new workspace version to NPM.")
    .option("--workspace <workspace>", "Workspace name, eg @langchain/core")
    .option("--bump-deps", "Whether or not to bump other workspaces that depend on this one.")
    .option("--tag <tag>", "Optionally specify a tag to publish to.");

  program.parse();

  /**
   * @type {{ workspace: string, bumpDeps?: boolean, tag?: string }}
   */
  const options = program.opts();
  if (!options.workspace) {
    throw new Error("--workspace is a required flag.");
  }

  // Find the workspace package.json's.
  const allWorkspaces = getAllWorkspaces();
  const matchingWorkspace = allWorkspaces.find(({ packageJSON }) => packageJSON.name === options.workspace);
  
  if (!matchingWorkspace) {
    throw new Error(`Could not find workspace ${options.workspace}`);
  }

  // Checkout new "release" branch & push
  checkoutReleaseBranch();

  // Run build, lint, tests
  console.log("Running build, lint, and tests.");
  execSync(`yarn turbo:command run --filter ${options.workspace} build lint test --concurrency 1`);
  console.log("Successfully ran build, lint, and tests.");

  // Only run export tests for primary projects.
  if (PRIMARY_PROJECTS.includes(options.workspace.trim())) {
    // Run export tests.
    // LangChain must be built before running export tests.
    console.log("Building 'langchain' and running export tests.");
    execSync(`yarn run turbo:command build --filter=langchain`);
    execSync(`yarn run test:exports:docker`);
    console.log("Successfully built langchain, and tested exports.");
  } else {
    console.log("Skipping export tests for non primary project.");
  }

  const npm2FACode = await getUserInput("Please enter your NPM 2FA authentication code:");

  // Run `release-it` on workspace
  await runYarnRelease(matchingWorkspace.dir, npm2FACode, options.tag);
  
  // Log release branch URL
  console.log("\x1b[34m%s\x1b[0m", "🔗 Open https://github.com/langchain-ai/langchainjs/compare/release?expand=1 and merge the release PR.");

  // If `bump-deps` flag is set, find all workspaces which depend on the input workspace.
  // Then, update their package.json to use the new version of the input workspace.
  // This will create a new branch, commit and push the changes and log the branch URL.
  if (options.bumpDeps) {
    bumpDeps(
      options.workspace,
      matchingWorkspace.dir,
      allWorkspaces,
      options.tag
    );
  }
};

main();
