/* eslint-disable import/no-extraneous-dependencies */
import path from "path";
import { green } from "picocolors";
import { tryGitInit } from "./helpers/git";
import { isFolderEmpty } from "./helpers/is-folder-empty";
import { isWriteable } from "./helpers/is-writeable";
import { makeDir } from "./helpers/make-dir";

import { installTemplate } from "./helpers/templates";

export type InstallAppArgs = {
  appPath: string;
};

export async function createApp({ appPath }: InstallAppArgs): Promise<void> {
  const root = path.resolve(appPath);

  if (!(await isWriteable(path.dirname(root)))) {
    console.error(
      "The application path is not writable, please check folder permissions and try again."
    );
    console.error(
      "It is likely you do not have write permissions for this folder."
    );
    process.exit(1);
  }

  const appName = path.basename(root);

  await makeDir(root);
  if (!isFolderEmpty(root, appName)) {
    process.exit(1);
  }

  console.log(`Creating a new LangChain integration in ${green(root)}.`);
  console.log();

  await installTemplate({ root, appName });

  process.chdir(root);
  if (tryGitInit(root)) {
    console.log("Initialized a git repository.");
    console.log();
  }

  console.log(`${green("Success!")} Created ${appName} at ${appPath}`);
  console.log();
  console.log(`Run "cd ${appPath} to see your new integration.`);
  console.log();
}
