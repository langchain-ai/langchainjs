#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

// Type definition for workspace packages
interface WorkspacePackage {
  pkg: PackageJson;
  path: string;
}

interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

// In Docker, packages are mounted at specific paths
const dockerPackages: WorkspacePackage[] = [
  { pkg: { name: "langchain" }, path: "/langchain" },
  { pkg: { name: "@langchain/core" }, path: "/langchain-core" },
  { pkg: { name: "@langchain/classic" }, path: "/langchain-classic" },
  { pkg: { name: "@langchain/openai" }, path: "/langchain-openai" },
  { pkg: { name: "@langchain/anthropic" }, path: "/langchain-anthropic" },
  { pkg: { name: "@langchain/community" }, path: "/langchain-community" },
  { pkg: { name: "@langchain/cohere" }, path: "/langchain-cohere" },
  { pkg: { name: "@langchain/ollama" }, path: "/langchain-ollama" },
  {
    pkg: { name: "@langchain/google-gauth" },
    path: "/langchain-google-gauth",
  },
  {
    pkg: { name: "@langchain/standard-tests" },
    path: "/langchain-standard-tests",
  },
  {
    pkg: { name: "@langchain/textsplitters" },
    path: "/langchain-textsplitters",
  },
  { pkg: { name: "@langchain/build" }, path: "/langchain-build" },
  { pkg: { name: "@langchain/eslint" }, path: "/langchain-eslint" },
  { pkg: { name: "@langchain/tsconfig" }, path: "/langchain-tsconfig" },
];

class EnvironmentTestRunner {
  private testRoot: string;
  private packageName: string;
  private isBun: boolean;
  private availablePackages: Set<string> = new Set();

  constructor() {
    this.testRoot = "/app";
    this.packageName = path.basename("/package"); // Package is always mounted at /package
    this.isBun = process.env.BUN_ENV === "true";
  }

  private async execCommand(
    command: string,
    args: string[],
    cwd?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd,
        stdio: "inherit",
        shell: true,
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Copy a directory from src to dest, excluding files that match the excludePatterns
   * @param src - The source directory
   * @param dest - The destination directory
   * @param excludePatterns - An array of file names to exclude from the copy
   */
  private async copyDirectory(
    src: string,
    dest: string,
    excludePatterns: string[] = []
  ): Promise<void> {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip excluded patterns
        if (excludePatterns.some((pattern) => entry.name === pattern)) {
          return;
        }

        if (entry.isDirectory()) {
          await this.copyDirectory(srcPath, destPath, excludePatterns);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      })
    );
  }

  /**
   * Update the package.json file at the given filePath to use workspace dependencies
   * @param filePath - The path to the package.json file to update
   * @param packages - The list of workspace packages
   */
  private async updatePackageJson(
    filePath: string,
    packages: WorkspacePackage[]
  ): Promise<void> {
    const content = await fs.readFile(filePath, "utf8");
    let packageJson: PackageJson = JSON.parse(content);

    // Get list of available package names
    const availablePackageNames = new Set(
      packages.map(({ pkg }) => pkg.name).filter(Boolean)
    );

    // Update both dependencies and devDependencies
    for (const depType of ["dependencies", "devDependencies"] as const) {
      if (!packageJson[depType]) {
        continue;
      }

      // Iterate through all dependencies
      for (const [depName, depVersion] of Object.entries(
        packageJson[depType]!
      )) {
        // If this dependency is one of our local packages, keep it as workspace dependency
        if (availablePackageNames.has(depName)) {
          packageJson[depType]![depName] = "workspace:*";
        } else if (depVersion === "workspace:*") {
          // Only replace workspace:* with npm version if package is NOT available locally
          if (depName === "@langchain/core") {
            packageJson[depType]![depName] = ">=0.3.58 <0.4.0";
          } else if (depName === "langchain") {
            packageJson[depType]![depName] = "^0.3.30";
          } else {
            // For other workspace dependencies not available locally, use latest
            packageJson[depType]![depName] = "*";
          }
        }
        // Otherwise, keep the existing version (non-workspace dependencies)
      }
    }

    await fs.writeFile(filePath, JSON.stringify(packageJson, null, 2));
  }

  /**
   * Copy the test package files to the test root
   */
  private async prepareSandbox(): Promise<void> {
    console.log("🔧 Preparing sandbox environment...");

    // Copy test package files
    const excludePatterns = [
      "node_modules",
      "dist",
      "dist-cjs",
      "dist-esm",
      "build",
      ".next",
      ".turbo",
    ];

    await this.copyDirectory("/package", this.testRoot, excludePatterns);

    // Copy .eslintrc.json if it exists
    try {
      await fs.copyFile(
        "/package/.eslintrc.json",
        path.join(this.testRoot, ".eslintrc.json")
      );
    } catch {
      // File doesn't exist, that's okay
    }

    // Enable corepack for pnpm
    if (!this.isBun) {
      await this.execCommand("corepack", ["enable"]);
    }
  }

  /**
   * Setup the workspace packages
   */
  private async setupPackages(): Promise<void> {
    console.log("📦 Setting up workspace packages...");

    // Filter to only include packages that exist
    const packages: WorkspacePackage[] = [];
    for (const dockerPkg of dockerPackages) {
      await fs.access(dockerPkg.path);
      const pkgJsonPath = path.join(dockerPkg.path, "package.json");
      const pkgJson = JSON.parse(
        await fs.readFile(pkgJsonPath, "utf-8")
      ) as PackageJson;
      packages.push({ pkg: pkgJson, path: dockerPkg.path });

      // Track available packages for verification
      if (pkgJson.name) {
        this.availablePackages.add(pkgJson.name);
      }
    }

    const libsDir = path.join(this.testRoot, "libs");
    await fs.mkdir(libsDir, { recursive: true });

    // Copy available packages
    await Promise.all(
      packages.map(async ({ pkg, path: pkgPath }) => {
        if (!pkg.name || !pkgPath) {
          return;
        }

        let destDirName: string;
        if (pkg.name === "langchain") {
          destDirName = "langchain";
        } else {
          destDirName = pkg.name.replace("@langchain/", "langchain-");
        }
        const destDir = path.join(libsDir, destDirName);
        await fs.mkdir(destDir, { recursive: true });

        console.log(`  ✓ Copying ${pkg.name} from ${pkgPath}`);
        await this.copyDirectory(pkgPath, destDir, ["node_modules"]);
      })
    );

    // Update package.json files
    console.log("📝 Updating package.json files...");

    // Update root package.json
    await this.updatePackageJson(
      path.join(this.testRoot, "package.json"),
      packages
    );

    // Update package.json files in libs
    const libsDirs = await fs.readdir(libsDir);
    await Promise.all(
      libsDirs.map(async (dir) => {
        const pkgJsonPath = path.join(libsDir, dir, "package.json");
        await this.updatePackageJson(pkgJsonPath, packages);
      })
    );
  }

  /**
   * Install dependencies for the test
   */
  private async installDependencies(): Promise<void> {
    console.log("📥 Installing dependencies...");

    if (this.isBun) {
      // Read the existing package.json to add workspaces field
      const packageJsonPath = path.join(this.testRoot, "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );

      // Add workspaces configuration for Bun
      packageJson.workspaces = [".", "libs/*"];

      // Write back the updated package.json
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      await this.execCommand(
        "bun",
        ["install", "--ignore-scripts"],
        this.testRoot
      );
    } else {
      // Setup pnpm workspace
      const workspaceYaml = `packages:
  - "."
  - "libs/*"
`;
      await fs.writeFile(
        path.join(this.testRoot, "pnpm-workspace.yaml"),
        workspaceYaml
      );

      await this.execCommand("pnpm", ["install", "--prod"], this.testRoot);
    }
  }

  /**
   * Verify that all local langchain packages are using workspace dependencies
   * and not production packages from npm
   */
  private async verifyLocalPackages(): Promise<void> {
    if (this.isBun) {
      console.log("🔍 Skipping local package verification for Bun...");
      return;
    }

    console.log("🔍 Verifying local package usage...");

    const nodeModulesDir = path.join(this.testRoot, "node_modules");
    const pnpmDir = path.join(nodeModulesDir, ".pnpm");

    const errors: string[] = [];

    // Only verify packages that are actually available in this container
    for (const pkgName of this.availablePackages) {
      const pkgPath = pkgName.startsWith("@")
        ? path.join(nodeModulesDir, ...pkgName.split("/"))
        : path.join(nodeModulesDir, pkgName);

      try {
        // Check if the package exists in node_modules
        const stats = await fs.lstat(pkgPath);

        if (stats.isSymbolicLink()) {
          // Good - it's a symlink (workspace dependency)
          const linkTarget = await fs.readlink(pkgPath);
          console.log(`  ✓ ${pkgName} → ${linkTarget} (workspace)`);
        } else {
          // Bad - it's a real directory (npm package)
          errors.push(`${pkgName} is not a workspace dependency!`);

          // Try to get version info to help debug
          try {
            const pkgJsonPath = path.join(pkgPath, "package.json");
            const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
            errors.push(`  Found version ${pkgJson.version} from npm registry`);
          } catch {
            // Ignore errors reading package.json
          }
        }
      } catch (error: any) {
        // Package doesn't exist in this test environment, which is OK
        if (error.code !== "ENOENT") {
          errors.push(`Error checking ${pkgName}: ${error.message}`);
        }
      }
    }

    // Also check pnpm store for any downloaded versions of our available packages
    const pnpmEntries = await fs.readdir(pnpmDir);

    // Only check for the packages that we're explicitly managing as workspace dependencies
    const problematicDownloads = pnpmEntries.filter((entry) => {
      // Check if this pnpm entry is for one of our available packages
      for (const pkgName of this.availablePackages) {
        const pnpmPackageName = pkgName.replace("@", "").replace("/", "+");
        // Look for exact package matches (not sub-dependencies like @langchain/weaviate)
        if (
          entry.startsWith(`${pnpmPackageName}@`) &&
          !entry.includes("workspace")
        ) {
          return true;
        }
      }
      return false;
    });

    if (problematicDownloads.length > 0) {
      errors.push(
        "Found production versions of workspace packages in pnpm store:"
      );
      problematicDownloads.forEach((entry) => {
        errors.push(`  - ${entry}`);
      });
    }

    if (errors.length > 0) {
      console.error("❌ Verification failed!");
      errors.forEach((error) => console.error(`   ${error}`));
      throw new Error(
        "Local packages verification failed. Production packages were installed instead of workspace packages."
      );
    }

    console.log("  ✅ All local packages verified!");
  }

  /**
   * Run the build for the test
   */
  private async runBuild(): Promise<void> {
    // Skip build for Bun since it can run TypeScript directly
    if (this.isBun) {
      console.log("🔨 Skipping build for Bun (runs TypeScript directly)...");
      return;
    }

    console.log("🔨 Running build...");
    await this.execCommand("pnpm", ["run", "build"], this.testRoot);
  }

  /**
   * Run the tests for the test
   */
  private async runTests(): Promise<void> {
    console.log("🧪 Running tests...");
    const cmd = this.isBun ? "bun" : "pnpm";
    await this.execCommand(cmd, ["run", "test"], this.testRoot);
  }

  /**
   * Run the test
   */
  public async run(): Promise<void> {
    try {
      console.log(`🚀 Starting environment test for ${this.packageName}`);

      const runtimeIcon = this.isBun ? "🐹" : "🐢";
      console.log(`${runtimeIcon} Runtime: ${this.isBun ? "Bun" : "Node.js"}`);

      await this.prepareSandbox();
      await this.setupPackages();
      await this.installDependencies();
      await this.verifyLocalPackages();
      await this.runBuild();
      await this.runTests();

      console.log("✅ All tests passed!");
    } catch (error) {
      console.error("❌ Test failed:", error);
      process.exit(1);
    }
  }
}

// Run the test
const runner = new EnvironmentTestRunner();
runner.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
