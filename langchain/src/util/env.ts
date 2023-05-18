// Inlined from https://github.com/flexdinesh/browser-or-node
declare global {
  const Deno:
    | {
        version: {
          deno: string;
        };
      }
    | undefined;
}

export const isBrowser = () =>
  typeof window !== "undefined" && typeof window.document !== "undefined";

export const isWebWorker = () =>
  typeof globalThis === "object" &&
  globalThis.constructor &&
  globalThis.constructor.name === "DedicatedWorkerGlobalScope";

export const isJsDom = () =>
  (typeof window !== "undefined" && window.name === "nodejs") ||
  (typeof navigator !== "undefined" &&
    (navigator.userAgent.includes("Node.js") ||
      navigator.userAgent.includes("jsdom")));

// Supabase Edge Function provides a `Deno` global object
// without `version` property
export const isDeno = () => typeof Deno !== "undefined";

// Mark not-as-node if in Supabase Edge Function
export const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined" &&
  !isDeno();

export const getEnv = () => {
  let env: string;
  if (isBrowser()) {
    env = "browser";
  } else if (isNode()) {
    env = "node";
  } else if (isWebWorker()) {
    env = "webworker";
  } else if (isJsDom()) {
    env = "jsdom";
  } else if (isDeno()) {
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
