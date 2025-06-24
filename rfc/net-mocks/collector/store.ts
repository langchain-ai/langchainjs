import { NetMockContextHooks } from ".";
import { HARLog } from "./har";
import { HARArchive } from "./spec";
import { PromiseOrValue, toFileSafeString } from "./utils";

/**
 * Interface representing a storage mechanism for HAR logs.
 * Provides methods to retrieve, list, and save HAR logs by key.
 */
export interface ArchiveStore {
  /**
   * Retrieves a HAR log by its key.
   * @param {string} key - The identifier or filename of the HAR log to retrieve.
   * @returns {PromiseOrValue<HARArchive | undefined>} The HAR log associated with the given key.
   */
  get(key: string): PromiseOrValue<HARArchive | undefined>;

  /**
   * Retrieves all HAR logs available in the store.
   * @returns {PromiseOrValue<HARArchive[]>} An array of all HAR logs in the store.
   */
  getAll(): PromiseOrValue<HARArchive[]>;

  /**
   * Saves a HAR log to the store under the specified key.
   * @param {string} key - The identifier or filename to save the HAR log under.
   * @param {HARArchive} log - The HAR log object to save.
   * @returns {PromiseOrValue<void>} A promise that resolves when the save is complete.
   */
  save(key: string, log: HARArchive): PromiseOrValue<void>;
}

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
      return path.join(testPath, "__data__");
    };

    const getArchivePath = (key: string) => {
      return path.join(getOutputDir(), toFileSafeString(key) + ".har");
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
      async getAll() {
        const files = await fs.readdir(getOutputDir());
        return Promise.all(
          files.map(async (file) => {
            const content = await fs.readFile(file, "utf-8");
            return JSON.parse(content);
          })
        );
      },
      async save(key: string, log: HARLog) {
        const filePath = getArchivePath(key);
        const dir = path.dirname(filePath);
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch (err: any) {
          // ignore error if it already exists
          if (err.code !== "EEXIST") throw err;
        }
        await fs.writeFile(filePath, JSON.stringify(log));
      },
    };
  }
  throw new Error("No archive store found for current environment");
}
