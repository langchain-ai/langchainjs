import { BatchInterceptor } from "@mswjs/interceptors";
import { ArchiveStore, NetMockContextHooks } from "./mock";
import { toFileSafeString } from "./utils";
import { HARArchive } from "./spec";

declare global {
  interface Window {
    env?: Record<string, string>;
  }
}

/**
 * Creates and returns a BatchInterceptor appropriate for the current environment (browser or Node.js).
 *
 * This function dynamically imports the correct set of interceptors based on the detected global environment.
 * - In a browser environment (`globalThis.window` is defined), it attempts to import browser interceptors.
 * - In a Node.js environment (`globalThis.process` is defined), it imports Node.js interceptors.
 * - If neither environment is detected, it throws an error.
 *
 * @returns {Promise<BatchInterceptor>} A promise that resolves to a configured BatchInterceptor instance.
 * @throws {Error} If no suitable interceptor is found for the current environment.
 */
export async function getInterceptor() {
  if (globalThis.window !== undefined) {
    // FIXME: browser interceptors are awkward to import since ts auto assumes node types
    // A no-op right now since we don't do integration tests directly in the browser
    throw new Error("Not implemented");
    // Once a fix is merged for msw, syntax should look like this:
    // const { default: browserInterceptors } = await import(
    //   "@mswjs/interceptors/presets/browser"
    // );
    // const interceptor = new BatchInterceptor({
    //   name: "langchain-net-mocks",
    //   interceptors: browserInterceptors,
    // });
    // return interceptor;
  }
  if (globalThis.process !== undefined) {
    const { default: nodeInterceptors } = await import(
      "@mswjs/interceptors/presets/node"
    );
    const interceptor = new BatchInterceptor({
      name: "langchain-node-net-mocks",
      interceptors: nodeInterceptors,
    });
    return interceptor;
  }
  throw new Error("No interceptor found for current environment");
}

export type EnvironmentBatchInterceptor = Awaited<
  ReturnType<typeof getInterceptor>
>;

/**
 * Returns an ArchiveStore implementation appropriate for the current environment.
 *
 * In a Node.js environment, this function provides an ArchiveStore that reads and writes HAR logs
 * to the local filesystem using the `node:fs/promises` API. The store supports retrieving a single
 * HAR log by key (filename), retrieving all HAR logs in the current directory, and saving a HAR log
 * to a file.
 *
 * @returns {Promise<ArchiveStore>} A promise that resolves to an ArchiveStore instance for the current environment.
 */
export async function getArchiveStore(
  hooks: NetMockContextHooks | null
): Promise<ArchiveStore> {
  if (globalThis.window !== undefined) {
    // We currently don't do integration tests directly in the browser,
    // so we don't need to implement this for now.
    throw new Error("Not implemented");
  }
  if (globalThis.process !== undefined) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const getOutputDir = () => {
      const testPath = path.dirname(hooks?.getTestPath() ?? "./");
      return path.join(testPath, "__snapshots__");
    };

    const getArchivePath = (key: string) => {
      return path.join(getOutputDir(), `${toFileSafeString(key)}.har`);
    };

    return {
      async get(key: string) {
        try {
          const file = await fs.readFile(getArchivePath(key), "utf-8");
          return JSON.parse(file);
        } catch (err) {
          return undefined;
        }
      },
      async save(key: string, archive: HARArchive) {
        const filePath = getArchivePath(key);
        const dir = path.dirname(filePath);
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch (err: unknown) {
          // ignore error if it already exists
          if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            err.code !== "EEXIST"
          )
            throw err;
        }
        await fs.writeFile(filePath, JSON.stringify(archive));
      },
    };
  }
  throw new Error("No archive store found for current environment");
}

/**
 * Safely retrieves an environment variable value, supporting both Node.js and browser environments.
 * Returns undefined if the variable is not set or not accessible in the current environment.
 *
 * @param {string} key - The name of the environment variable.
 * @param {Function} [transform] - An optional function to transform the value.
 * @returns {string | undefined} The value of the environment variable, or undefined if not found.
 */
export function getEnvironmentVariable(key: string): string | undefined;
export function getEnvironmentVariable<T>(
  key: string,
  transform: (value: string | undefined) => T
): T;
export function getEnvironmentVariable<T>(
  key: string,
  transform?: (value: string | undefined) => T
): T | string | undefined {
  let value: string | undefined;
  if (
    typeof globalThis.window !== "undefined" &&
    globalThis.window?.env &&
    typeof globalThis.window.env[key] === "string"
  ) {
    value = globalThis.window.env[key];
  }
  if (
    typeof globalThis.process !== "undefined" &&
    globalThis.process?.env &&
    typeof globalThis.process.env[key] === "string"
  ) {
    value = globalThis.process.env[key];
  }
  return transform ? transform(value) : value;
}
