import path from "path";
import fs from "fs/promises";
import os from "os";

import { copy } from "./copy.js";

/**
 * Install a internal template to a given `root` directory.
 */
export async function installTemplate({ appName, root }: any) {
  /**
   * Copy the template files to the target directory.
   */
  const templatePath = path.join(__dirname, "..", "template");
  const copySource = ["**"];

  console.log(`Initializing project...`);

  await copy(copySource, root, {
    parents: true,
    cwd: templatePath,
  });

  /**
   * Update the package.json scripts.
   */
  const packageJsonFile = path.join(root, "package.json");
  const packageJson: any = JSON.parse(
    await fs.readFile(packageJsonFile, "utf8")
  );
  packageJson.name = appName;

  await fs.writeFile(
    packageJsonFile,
    JSON.stringify(packageJson, null, 2) + os.EOL
  );

  await fs.writeFile(
    path.join(root, ".gitignore"),
    ["node_modules", "dist", ".yarn"].join("\n") + os.EOL
  );

  console.log("\nDone!\n");
}
