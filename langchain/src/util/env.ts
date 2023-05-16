import {
  isBrowser,
  isNode,
  isWebWorker,
  isJsDom,
  isDeno,
} from "browser-or-node";

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

export type RuntimeEnvironment = {
  library: string;
  libraryVersion?: string;
  runtime: string;
  runtimeVersion?: string;
};

let runtimeEnvironment: RuntimeEnvironment | undefined;

export async function getRuntimeEnvironment(): Promise<RuntimeEnvironment> {
  if (runtimeEnvironment === undefined) {
    const env = getEnv();

    runtimeEnvironment = {
      library: "langchain-js",
      runtime: env,
    };
  }
  return runtimeEnvironment;
}
