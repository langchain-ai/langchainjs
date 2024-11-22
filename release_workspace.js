const { execSync } = require("child_process");
const { Command } = require("commander");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");
const semver = require("semver");

const RELEASE_BRANCH = "release";
const MAIN_BRANCH = "main";

/**
 * Get the version of a workspace inside a directory.
 *
 * @param {string} workspaceDirectory
 * @returns {string} The version of the workspace in the input directory.
 */
function getWorkspaceVersion(workspaceDirectory) {
  const pkgJsonFile = fs.readFileSync(
    path.join(process.cwd(), workspaceDirectory, "package.json")
  );
  const parsedJSONFile = JSON.parse(pkgJsonFile);
  return parsedJSONFile.version;
}

/**
 * Finds all workspaces in the monorepo and returns an array of objects.
 * Each object in the return value contains the relative path to the workspace
 * directory, along with the full package.json file contents.
 *
 * @returns {Array<{ dir: string, packageJSON: Record<string, any>}>}
 */
function getAllWorkspaces() {
  const possibleWorkspaceDirectories = [
    "./libs/*",
    "./langchain",
    "./langchain-core",
  ];
  const allWorkspaces = possibleWorkspaceDirectories.flatMap(
    (workspaceDirectory) => {
      if (workspaceDirectory.endsWith("*")) {
        // List all folders inside directory, require, and return the package.json.
        const allDirs = fs.readdirSync(
          path.join(process.cwd(), workspaceDirectory.replace("*", ""))
        );
        const subDirs = allDirs.map((dir) => {
          return {
            dir: `${workspaceDirectory.replace("*", "")}${dir}`,
            packageJSON: require(path.join(
              process.cwd(),
              `${workspaceDirectory.replace("*", "")}${dir}`,
              "package.json"
            )),
          };
        });
        return subDirs;
      }
      const packageJSON = require(path.join(
        process.cwd(),
        workspaceDirectory,
        "package.json"
      ));
      return {
        dir: workspaceDirectory,
        packageJSON,
      };
    }
  );
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
function updateDependencies(
  workspaces,
  dependencyType,
  workspaceName,
  newVersion
) {
  const versionPrefixes = ["~", "^", ">", "<", ">=", "<=", "||", "*"];
  const skipVersions = ["latest", "workspace:*"];

  workspaces.forEach((workspace) => {
    const currentVersion =
      workspace.packageJSON[dependencyType]?.[workspaceName];
    if (currentVersion) {
      const prefix = versionPrefixes.find((p) => currentVersion.startsWith(p));
      const shouldSkip = skipVersions.some((v) => currentVersion === v);

      if (!shouldSkip) {
        const versionToUpdate = prefix ? `${prefix}${newVersion}` : newVersion;
        workspace.packageJSON[dependencyType][workspaceName] = versionToUpdate;
        fs.writeFileSync(
          path.join(workspace.dir, "package.json"),
          JSON.stringify(workspace.packageJSON, null, 2) + "\n"
        );
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
    const args = [
      "release-it",
      `--npm.otp=${npm2FACode}`,
      tagArg,
      "--config",
      ".release-it.json",
    ];

    console.log(`Running command: "yarn ${args.join(" ")}"`);

    const yarnReleaseProcess = spawn("yarn", args, { cwd: workingDirectory });

    let stdout = "";
    let stderr = "";

    yarnReleaseProcess.stdout.on("data", (data) => {
      stdout += data;
      // Still show output in real-time
      process.stdout.write(data);
    });

    yarnReleaseProcess.stderr.on("data", (data) => {
      stderr += data;
      // Still show errors in real-time
      process.stderr.write(data);
    });

    yarnReleaseProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`Process exited with code ${code}.\nError: ${stderr}`);
      }
    });

    yarnReleaseProcess.on("error", (err) => {
      reject(`Failed to start process: ${err.message}\nError: ${stderr}`);
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
 * @param {string} preReleaseVersion The version of the workspace before it was released.
 * @returns {void}
 */
function bumpDeps(
  workspaceName,
  workspaceDirectory,
  allWorkspaces,
  tag,
  preReleaseVersion
) {
  // Read workspace file, get version (edited by release-it), and bump pkgs to that version.
  let updatedWorkspaceVersion = getWorkspaceVersion(workspaceDirectory);
  if (!semver.valid(updatedWorkspaceVersion)) {
    console.error("Invalid workspace version: ", updatedWorkspaceVersion);
    process.exit(1);
  }

  // If the updated version is not greater than the pre-release version,
  // the branch is out of sync. Pull from github and check again.
  if (!semver.gt(updatedWorkspaceVersion, preReleaseVersion)) {
    console.log(
      "Updated version is not greater than the pre-release version. Pulling from github and checking again."
    );
    execSync(`git pull origin ${RELEASE_BRANCH}`);
    updatedWorkspaceVersion = getWorkspaceVersion(workspaceDirectory);
    if (!semver.gt(updatedWorkspaceVersion, preReleaseVersion)) {
      console.warn(
        `Workspace version has not changed in repo. Version in repo: ${updatedWorkspaceVersion}. Exiting.`
      );
      process.exit(0);
    }
  }

  console.log(`Bumping other packages which depend on ${workspaceName}.`);
  console.log(`Checking out ${MAIN_BRANCH} branch.`);

  // Separate variable for the branch name, incase it includes a tag.
  let versionString = updatedWorkspaceVersion;
  if (tag) {
    versionString = `${updatedWorkspaceVersion}-${tag}`;
  }

  execSync(`git checkout ${MAIN_BRANCH}`);
  const newBranchName = `bump-${workspaceName}-to-${versionString}`;
  console.log(`Checking out new branch: ${newBranchName}`);
  execSync(`git checkout -b ${newBranchName}`);

  const allWorkspacesWhichDependOn = allWorkspaces.filter(({ packageJSON }) =>
    Object.keys(packageJSON.dependencies ?? {}).includes(workspaceName)
  );
  const allWorkspacesWhichDevDependOn = allWorkspaces.filter(
    ({ packageJSON }) =>
      Object.keys(packageJSON.devDependencies ?? {}).includes(workspaceName)
  );
  const allWorkspacesWhichPeerDependOn = allWorkspaces.filter(
    ({ packageJSON }) =>
      Object.keys(packageJSON.peerDependencies ?? {}).includes(workspaceName)
  );

  // For console log, get all workspaces which depend and filter out duplicates.
  const allWhichDependOn = new Set(
    [
      ...allWorkspacesWhichDependOn,
      ...allWorkspacesWhichDevDependOn,
      ...allWorkspacesWhichPeerDependOn,
    ].map(({ packageJSON }) => packageJSON.name)
  );

  if (allWhichDependOn.size !== 0) {
    console.log(`Found ${
      [...allWhichDependOn].length
    } workspaces which depend on ${workspaceName}.
Workspaces:
- ${[...allWhichDependOn].map((name) => name).join("\n- ")}
`);
    // Update packages which depend on the input workspace.
    updateDependencies(
      allWorkspacesWhichDependOn,
      "dependencies",
      workspaceName,
      updatedWorkspaceVersion
    );
    updateDependencies(
      allWorkspacesWhichDevDependOn,
      "devDependencies",
      workspaceName,
      updatedWorkspaceVersion
    );
    updateDependencies(
      allWorkspacesWhichPeerDependOn,
      "peerDependencies",
      workspaceName,
      updatedWorkspaceVersion
    );
    console.log("Updated package.json's! Running yarn install.");

    try {
      execSync(`yarn install`);
    } catch (_) {
      console.log(
        "Yarn install failed. Likely because NPM has not finished publishing the new version. Continuing."
      );
    }

    // Add all current changes, commit, push and log branch URL.
    console.log("Adding and committing all changes.");
    execSync(`git add -A`);
    execSync(
      `git commit -m "all[minor]: bump deps on ${workspaceName} to ${versionString}"`
    );
    console.log("Pushing changes.");
    execSync(`git push -u origin ${newBranchName}`);
    console.log(
      "🔗 Open %s and merge the bump-deps PR.",
      `\x1b[34mhttps://github.com/langchain-ai/langchainjs/compare/${newBranchName}?expand=1\x1b[0m`
    );
  } else {
    console.log(`No workspaces depend on ${workspaceName}.`);
  }
}

/**
 * Create a commit message for the input workspace and version.
 *
 * @param {string} workspaceName
 * @param {string} version
 */
function createCommitMessage(workspaceName, version) {
  return `release(${workspaceName}): ${version}`;
}

/**
 * Commits all changes and pushes to the current branch.
 *
 * @param {string} workspaceName The name of the workspace being released
 * @param {string} version The new version being released
 * @returns {void}
 */
function commitAndPushChanges(workspaceName, version) {
  console.log("Committing and pushing changes...");
  const commitMsg = createCommitMessage(workspaceName, version);
  execSync("git add -A");
  execSync(`git commit -m "${commitMsg}"`);
  // Pushes to the current branch
  execSync("git push -u origin $(git rev-parse --abbrev-ref HEAD)");
  console.log("Successfully committed and pushed changes.");
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
  if (currentBranch === MAIN_BRANCH || currentBranch === RELEASE_BRANCH) {
    console.log(`Checking out '${RELEASE_BRANCH}' branch.`);
    execSync(`git checkout -B ${RELEASE_BRANCH}`);
    execSync(`git push -u origin ${RELEASE_BRANCH}`);
  } else {
    throw new Error(
      `Current branch is not ${MAIN_BRANCH} or ${RELEASE_BRANCH}. Current branch: ${currentBranch}`
    );
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
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\x1b[30m\x1b[47m${question}\x1b[0m`, (input) => {
      rl.close();
      resolve(input);
    });
  });
}

/**
 * Checks if there are any uncommitted changes in the git repository
 *
 * @returns {boolean} True if there are uncommitted changes, false otherwise
 */
function hasUncommittedChanges() {
  try {
    // This command returns empty string if no changes, or a string with changes if there are any
    const output = execSync("git status --porcelain").toString();
    return output.length > 0;
  } catch (error) {
    console.error("Error checking git status:", error);
    // If we can't check, better to assume there are changes
    return true;
  }
}

async function main() {
  const program = new Command();
  program
    .description("Release a new workspace version to NPM.")
    .option("--workspace <workspace>", "Workspace name, eg @langchain/core")
    .option(
      "--bump-deps",
      "Whether or not to bump other workspaces that depend on this one."
    )
    .option("--tag <tag>", "Optionally specify a tag to publish to.");

  program.parse();

  /**
   * @type {{ workspace: string, bumpDeps?: boolean, tag?: string }}
   */
  const options = program.opts();
  if (!options.workspace) {
    throw new Error("--workspace is a required flag.");
  }

  if (hasUncommittedChanges()) {
    console.warn(
      "[WARNING]: You have uncommitted changes. These will be included in the release commit."
    );
  }

  // Find the workspace package.json's.
  const allWorkspaces = getAllWorkspaces();
  const matchingWorkspace = allWorkspaces.find(
    ({ packageJSON }) => packageJSON.name === options.workspace
  );

  if (!matchingWorkspace) {
    throw new Error(`Could not find workspace ${options.workspace}`);
  }

  // Checkout new "release" branch & push
  checkoutReleaseBranch();

  // Run build, lint, tests
  console.log("Running build, lint, and tests.");
  execSync(
    `yarn turbo:command run --filter ${options.workspace} build lint test --concurrency 1`
  );
  console.log("Successfully ran build, lint, and tests.");

  const npm2FACode = await getUserInput(
    "Please enter your NPM 2FA authentication code:"
  );

  const preReleaseVersion = getWorkspaceVersion(matchingWorkspace.dir);

  // Run `release-it` on workspace
  await runYarnRelease(matchingWorkspace.dir, npm2FACode, options.tag);

  if (hasUncommittedChanges()) {
    const updatedVersion = getWorkspaceVersion(matchingWorkspace.dir);
    commitAndPushChanges(options.workspace, updatedVersion);
  }

  // Log release branch URL
  console.log(
    "🔗 Open %s and merge the release PR.",
    `\x1b[34mhttps://github.com/langchain-ai/langchainjs/compare/release?expand=1\x1b[0m`
  );

  // If `bump-deps` flag is set, find all workspaces which depend on the input workspace.
  // Then, update their package.json to use the new version of the input workspace.
  // This will create a new branch, commit and push the changes and log the branch URL.
  if (options.bumpDeps) {
    bumpDeps(
      options.workspace,
      matchingWorkspace.dir,
      allWorkspaces,
      options.tag,
      preReleaseVersion
    );
  }
}

main();
