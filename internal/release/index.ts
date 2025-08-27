import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import readline from "node:readline";

import { Command } from "commander";
import semver from "semver";

import { findWorkspacePackages, type WorkspacePackage } from "@langchain/build";

const RELEASE_BRANCH = "release";
const MAIN_BRANCH = "main";

/**
 * Handles execSync errors and logs them in a readable format.
 * @param {string} command
 * @param {{ doNotExit?: boolean }} [options] - Optional configuration
 * @param {boolean} [options.doNotExit] - Whether or not to exit the process on error
 */
function execSyncWithErrorHandling(
  command: string,
  options: { doNotExit?: boolean } = {}
) {
  try {
    cp.execSync(
      command,
      { stdio: "inherit" } // This will stream output in real-time
    );
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(error.message);
    if (!options.doNotExit) {
      process.exit(1);
    }
  }
}

/**
 * Get the version of a workspace inside a directory.
 *
 * @param {string} workspaceDirectory
 * @returns {string} The version of the workspace in the input directory.
 */
function getWorkspaceVersion(workspaceDirectory: string) {
  const pkgJsonFile = fs.readFileSync(
    path.join(process.cwd(), workspaceDirectory, "package.json")
  );
  const parsedJSONFile = JSON.parse(pkgJsonFile.toString());
  return parsedJSONFile.version;
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
  workspaces: WorkspacePackage[],
  dependencyType: "dependencies" | "devDependencies" | "peerDependencies",
  workspaceName: string,
  newVersion: string
) {
  const versionPrefixes = ["~", "^", ">", "<", ">=", "<=", "||", "*"];
  const skipVersions = ["latest", "workspace:*"];

  workspaces.forEach((workspace) => {
    const currentVersion = workspace.pkg[dependencyType]?.[workspaceName];
    if (currentVersion) {
      const prefix = versionPrefixes.find((p) => currentVersion.startsWith(p));
      const shouldSkip = skipVersions.some((v) => currentVersion === v);

      if (!shouldSkip) {
        const versionToUpdate = prefix ? `${prefix}${newVersion}` : newVersion;
        workspace.pkg[dependencyType]![workspaceName] = versionToUpdate;
        fs.writeFileSync(
          path.join(workspace.path, "package.json"),
          JSON.stringify(workspace.pkg, null, 2) + "\n"
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
 * @param {string} packageDirectory The directory to run pnpm release in.
 * @param {string} npm2FACode The 2FA code for NPM.
 * @param {string | undefined} tag An optional tag to publish to.
 * @returns {Promise<void>}
 */
async function runPnpmRelease(
  packageDirectory: string,
  npm2FACode: string,
  tag?: string
) {
  return new Promise<void>((resolve, reject) => {
    const workingDirectory = path.join(process.cwd(), packageDirectory);
    const tagArg = tag ? `--npm.tag=${tag}` : "";
    const args = [
      "release-it",
      `--npm.otp=${npm2FACode}`,
      tagArg,
      "--config",
      ".release-it.json",
    ];

    console.log(`Running command: "pnpm ${args.join(" ")}"`);

    // Use 'inherit' for stdio to allow direct CLI interaction
    const pnpmReleaseProcess = cp.spawn("pnpm", args, {
      stdio: "inherit",
      cwd: workingDirectory,
    });

    pnpmReleaseProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    pnpmReleaseProcess.on("error", (err) => {
      reject(new Error(`Failed to start process: ${err.message}`));
    });
  });
}

/**
 * Finds all `package.json`'s which contain the input workspace as a dependency.
 * Then, updates the dependency to the new version, runs pnpm install and
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
  workspaceName: string,
  workspaceDirectory: string,
  allWorkspaces: WorkspacePackage[],
  tag?: string,
  preReleaseVersion?: string
): void {
  // Read workspace file, get version (edited by release-it), and bump pkgs to that version.
  let updatedWorkspaceVersion = getWorkspaceVersion(workspaceDirectory);
  if (!semver.valid(updatedWorkspaceVersion)) {
    console.error("Invalid workspace version: ", updatedWorkspaceVersion);
    process.exit(1);
  }

  // If the updated version is not greater than the pre-release version,
  // the branch is out of sync. Pull from github and check again.
  if (
    preReleaseVersion &&
    !semver.gt(updatedWorkspaceVersion, preReleaseVersion)
  ) {
    console.log(
      "Updated version is not greater than the pre-release version. Pulling from github and checking again."
    );
    execSyncWithErrorHandling(`git pull origin ${RELEASE_BRANCH}`);
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

  execSyncWithErrorHandling(`git checkout ${MAIN_BRANCH}`);
  const newBranchName = `bump-${workspaceName}-to-${versionString}`;
  console.log(`Checking out new branch: ${newBranchName}`);
  execSyncWithErrorHandling(`git checkout -b ${newBranchName}`);

  const allWorkspacesWhichDependOn = allWorkspaces.filter(({ pkg }) =>
    Object.keys(pkg.dependencies ?? {}).includes(workspaceName)
  );
  const allWorkspacesWhichDevDependOn = allWorkspaces.filter(({ pkg }) =>
    Object.keys(pkg.devDependencies ?? {}).includes(workspaceName)
  );
  const allWorkspacesWhichPeerDependOn = allWorkspaces.filter(({ pkg }) =>
    Object.keys(pkg.peerDependencies ?? {}).includes(workspaceName)
  );

  // For console log, get all workspaces which depend and filter out duplicates.
  const allWhichDependOn = new Set(
    [
      ...allWorkspacesWhichDependOn,
      ...allWorkspacesWhichDevDependOn,
      ...allWorkspacesWhichPeerDependOn,
    ].map(({ pkg }) => pkg.name)
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
    console.log("Updated package.json's! Running pnpm install.");

    try {
      execSyncWithErrorHandling(`pnpm install`);
    } catch (_) {
      console.log(
        "pnpm install failed. Likely because NPM has not finished publishing the new version. Continuing."
      );
    }

    // Add all current changes, commit, push and log branch URL.
    console.log("Adding and committing all changes.");
    execSyncWithErrorHandling(`git add -A`);
    execSyncWithErrorHandling(
      `git commit -m "all[minor]: bump deps on ${workspaceName} to ${versionString}"`
    );
    console.log("Pushing changes.");
    execSyncWithErrorHandling(`git push -u origin ${newBranchName}`);
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
function createCommitMessage(workspaceName: string, version: string) {
  const cleanedWorkspaceName = workspaceName.replace("@langchain/", "");
  return `release(${cleanedWorkspaceName}): ${version}`;
}

/**
 * Commits all changes and pushes to the current branch.
 *
 * @param {string} workspaceName The name of the workspace being released
 * @param {string} version The new version being released
 * @param {boolean} onlyPush Whether or not to only push the changes, and not commit
 * @returns {void}
 */
function commitAndPushChanges(
  workspaceName: string,
  version: string,
  onlyPush: boolean
) {
  if (!onlyPush) {
    console.log("Committing changes...");
    const commitMsg = createCommitMessage(workspaceName, version);
    try {
      execSyncWithErrorHandling("git add -A", { doNotExit: true });
      execSyncWithErrorHandling(`git commit -m "${commitMsg}"`, {
        doNotExit: true,
      });
    } catch (_) {
      // No-op. Likely erroring because there are no unstaged changes.
    }
  }

  console.log("Pushing changes...");
  // Pushes to the current branch
  execSyncWithErrorHandling(
    "git push -u origin $(git rev-parse --abbrev-ref HEAD)"
  );
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
  const currentBranch = cp
    .execSync("git branch --show-current")
    .toString()
    .trim();
  if (currentBranch === MAIN_BRANCH || currentBranch === RELEASE_BRANCH) {
    console.log(`Checking out '${RELEASE_BRANCH}' branch.`);
    execSyncWithErrorHandling(`git checkout -B ${RELEASE_BRANCH}`);
    execSyncWithErrorHandling(`git push -u origin ${RELEASE_BRANCH}`);
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
async function getUserInput(question: string) {
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
 * Checks if there are any uncommitted changes in the git repository.
 *
 * @returns {boolean} True if there are uncommitted changes, false otherwise
 */
function hasUncommittedChanges() {
  try {
    // Check for uncommitted changes (both staged and unstaged)
    const uncommittedOutput = cp.execSync("git status --porcelain").toString();

    return uncommittedOutput.length > 0;
  } catch (error) {
    console.error("Error checking git status:", error);
    // If we can't check, better to assume there are changes
    return true;
  }
}

/**
 * Checks if there are any staged commits in the git repository.
 *
 * @returns {boolean} True if there are staged changes, false otherwise
 */
function hasStagedChanges() {
  try {
    // Check for staged but unpushed changes
    const unPushedOutput = cp.execSync("git log '@{u}..'").toString();

    return unPushedOutput.length > 0;
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

  const packages = await findWorkspacePackages(process.cwd(), {
    packageQuery: options.workspace,
  });

  if (packages.length === 0) {
    throw new Error(`No workspace found matching "${options.workspace}"`);
  }

  if (hasUncommittedChanges()) {
    console.warn(
      "[WARNING]: You have uncommitted changes. These will be included in the release commit."
    );
  }

  // Checkout new "release" branch & push
  checkoutReleaseBranch();

  for (const pkg of packages) {
    // Run build, lint, tests
    console.log(`[${pkg.pkg.name}] Running build, lint, and tests.`);
    execSyncWithErrorHandling(`pnpm --filter ${pkg.pkg.name} build`);
    execSyncWithErrorHandling(`pnpm --filter ${pkg.pkg.name} lint`);
    execSyncWithErrorHandling(`pnpm --filter ${pkg.pkg.name} test`);
    console.log(`[${pkg.pkg.name}] Successfully ran build, lint, and tests.`);

    const npm2FACode = (await getUserInput(
      "Please enter your NPM 2FA authentication code:"
    )) as string;

    const preReleaseVersion = getWorkspaceVersion(pkg.path);

    // Run `release-it` on workspace
    await runPnpmRelease(pkg.path, npm2FACode, options.tag);

    const hasStaged = hasStagedChanges();
    const hasUnCommitted = hasUncommittedChanges();
    if (hasStaged || hasUnCommitted) {
      const updatedVersion = getWorkspaceVersion(pkg.path);
      // Only push and do not commit if there are staged changes and no uncommitted changes
      const onlyPush = hasStaged && !hasUnCommitted;
      commitAndPushChanges(options.workspace, updatedVersion, onlyPush);
    }

    // Log release branch URL
    console.log(
      "🔗 Open %s and merge the release PR.",
      `\x1b[34mhttps://github.com/langchain-ai/langchainjs/compare/release?expand=1\x1b[0m`
    );

    if (!pkg.pkg.name) {
      throw new Error(
        `Package ${pkg.path} has no "name" field in its package.json`
      );
    }

    // If `bump-deps` flag is set, find all workspaces which depend on the input workspace.
    // Then, update their package.json to use the new version of the input workspace.
    // This will create a new branch, commit and push the changes and log the branch URL.
    if (options.bumpDeps) {
      bumpDeps(
        pkg.pkg.name,
        pkg.path,
        packages,
        options.tag,
        preReleaseVersion
      );
    }
  }
}

main().catch((error) => {
  console.error("❌ release execution failed:", error);
  process.exit(1);
});
