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
