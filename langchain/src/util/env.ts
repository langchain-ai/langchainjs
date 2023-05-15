import {
  isBrowser,
  isNode,
  isWebWorker,
  isJsDom,
  isDeno,
} from "browser-or-node";
import { platform } from "os";
import { fileURLToPath } from "url";
import { dirname, join as joinPath } from "path";
import { version as nodeVersion } from "process";
import fs from "fs";

export const getEnv = () => {
  let env: string;
  if (isBrowser) {
    env = "browser";
  } else if (isNode) {
    env = "node";
  } else if (isWebWorker) {
    env = "webworker";
  } else if (isJsDom) {
    env = "jsdom";
  } else if (isDeno) {
    env = "deno";
  } else {
    env = "other";
  }

  return env;
};

async function getVersion(): Promise<string> {
  if (isNode || isDeno) {
    const fileName = fileURLToPath(import.meta.url);
    const dirName = dirname(fileName);
    const rawPackageJson = await fs.promises.readFile(
      joinPath(dirName, "../../package.json"),
      "utf-8"
    );
    const packageJson = JSON.parse(rawPackageJson);
    return packageJson.version;
  } else {
    // TODO: Implement for other environments
    return "unknown";
  }
}

export type RuntimeEnvironment = {
  library: string;
  libraryVersion: string;
  platform: string;
  runtime: string;
  runtimeVersion: string;
};

let runtimeEnvironment: RuntimeEnvironment | undefined;

export async function getRuntimeEnvironment(): Promise<RuntimeEnvironment> {
  if (runtimeEnvironment === undefined) {
    const langchainVersion = await getVersion();
    const env = getEnv();
    let runtimeVersion: string;

    switch (env) {
      case "node":
        runtimeVersion = nodeVersion;
        break;
      default:
        runtimeVersion = "unknown";
    }

    runtimeEnvironment = {
      library: "langchain-js",
      libraryVersion: langchainVersion,
      platform: platform(),
      runtime: env,
      runtimeVersion,
    };
  }
  return runtimeEnvironment;
}
