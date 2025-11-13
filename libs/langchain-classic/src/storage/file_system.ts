import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BaseStore } from "@langchain/core/stores";

/**
 * File system implementation of the BaseStore using a dictionary. Used for
 * storing key-value pairs in the file system.
 * @example
 * ```typescript
 * const store = await LocalFileStore.fromPath("./messages");
 * await store.mset(
 *   Array.from({ length: 5 }).map((_, index) => [
 *     `message:id:${index}`,
 *     new TextEncoder().encode(
 *       JSON.stringify(
 *         index % 2 === 0
 *           ? new AIMessage("ai stuff...")
 *           : new HumanMessage("human stuff..."),
 *       ),
 *     ),
 *   ]),
 * );
 * const retrievedMessages = await store.mget(["message:id:0", "message:id:1"]);
 * console.log(retrievedMessages.map((v) => new TextDecoder().decode(v)));
 * for await (const key of store.yieldKeys("message:id:")) {
 *   await store.mdelete([key]);
 * }
 * ```
 *
 * @security **Security Notice** This file store
 * can alter any text file in the provided directory and any subfolders.
 * Make sure that the path you specify when initializing the store is free
 * of other files.
 */
export class LocalFileStore extends BaseStore<string, Uint8Array> {
  lc_namespace = ["langchain", "storage"];

  rootPath: string;

  private keyLocks: Map<string, Promise<void>> = new Map();

  constructor(fields: { rootPath: string }) {
    super(fields);
    this.rootPath = fields.rootPath;
  }

  /**
   * Read and parse the file at the given path.
   * @param key The key to read the file for.
   * @returns Promise that resolves to the parsed file content.
   */
  private async getParsedFile(key: string): Promise<Uint8Array | undefined> {
    // Validate the key to prevent path traversal
    if (!/^[a-zA-Z0-9_\-:.]+$/.test(key)) {
      throw new Error(
        "Invalid key. Only alphanumeric characters, underscores, hyphens, colons, and periods are allowed."
      );
    }
    try {
      const fileContent = await fs.readFile(this.getFullPath(key));
      if (!fileContent) {
        return undefined;
      }
      return fileContent;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      // File does not exist yet.
      if ("code" in e && e.code === "ENOENT") {
        return undefined;
      }
      throw new Error(
        `Error reading and parsing file at path: ${
          this.rootPath
        }.\nError: ${JSON.stringify(e)}`
      );
    }
  }

  /**
   * Writes the given key-value pairs to the file at the given path.
   * @param fileContent An object with the key-value pairs to be written to the file.
   */
  private async setFileContent(content: Uint8Array, key: string) {
    await this.withKeyLock(key, async () => {
      const fullPath = this.getFullPath(key);
      try {
        await this.writeFileAtomically(content, fullPath);
      } catch (error) {
        throw new Error(
          `Error writing file at path: ${fullPath}.\nError: ${JSON.stringify(
            error
          )}`
        );
      }
    });
  }

  /**
   * Returns the full path of the file where the value of the given key is stored.
   * @param key the key to get the full path for
   */
  private getFullPath(key: string): string {
    try {
      const keyAsTxtFile = `${key}.txt`;

      // Validate the key to prevent path traversal
      if (!/^[a-zA-Z0-9_.\-/]+$/.test(key)) {
        throw new Error(`Invalid characters in key: ${key}`);
      }

      const fullPath = path.resolve(this.rootPath, keyAsTxtFile);
      const commonPath = path.resolve(this.rootPath);

      if (!fullPath.startsWith(commonPath)) {
        throw new Error(
          `Invalid key: ${key}. Key should be relative to the root path. ` +
            `Root path: ${this.rootPath}, Full path: ${fullPath}`
        );
      }

      return fullPath;
    } catch (e) {
      throw new Error(
        `Error getting full path for key: ${key}.\nError: ${String(e)}`
      );
    }
  }

  /**
   * Retrieves the values associated with the given keys from the store.
   * @param keys Keys to retrieve values for.
   * @returns Array of values associated with the given keys.
   */
  async mget(keys: string[]) {
    const values: (Uint8Array | undefined)[] = [];
    for (const key of keys) {
      const fileContent = await this.getParsedFile(key);
      values.push(fileContent);
    }
    return values;
  }

  /**
   * Sets the values for the given keys in the store.
   * The last value for duplicate keys will be used.
   * @param keyValuePairs Array of key-value pairs to set in the store.
   * @returns Promise that resolves when all key-value pairs have been set.
   */
  async mset(keyValuePairs: [string, Uint8Array][]): Promise<void> {
    const deduped = new Map<string, Uint8Array>();
    for (const [key, value] of keyValuePairs) {
      deduped.set(key, value);
    }

    await Promise.all(
      Array.from(deduped.entries(), ([key, value]) =>
        this.setFileContent(value, key)
      )
    );
  }

  /**
   * Deletes the given keys and their associated values from the store.
   * @param keys Keys to delete from the store.
   * @returns Promise that resolves when all keys have been deleted.
   */
  async mdelete(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((key) =>
        this.withKeyLock(key, async () => {
          try {
            await fs.unlink(this.getFullPath(key));
          } catch (error) {
            if (!error || (error as { code?: string }).code !== "ENOENT") {
              throw error;
            }
          }
        })
      )
    );
  }

  /**
   * Asynchronous generator that yields keys from the store. If a prefix is
   * provided, it only yields keys that start with the prefix.
   * @param prefix Optional prefix to filter keys.
   * @returns AsyncGenerator that yields keys from the store.
   */
  async *yieldKeys(prefix?: string): AsyncGenerator<string> {
    const allFiles: string[] = await fs.readdir(this.rootPath);
    const allKeys = allFiles
      .filter((file) => file.endsWith(".txt"))
      .map((file) => file.replace(/\.txt$/, ""));
    for (const key of allKeys) {
      if (prefix === undefined || key.startsWith(prefix)) {
        yield key;
      }
    }
  }

  /**
   * Static method for initializing the class.
   * Preforms a check to see if the directory exists, and if not, creates it.
   * @param path Path to the directory.
   * @returns Promise that resolves to an instance of the class.
   */
  static async fromPath(rootPath: string): Promise<LocalFileStore> {
    try {
      // Verifies the directory exists at the provided path, and that it is readable and writable.
      await fs.access(rootPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      try {
        // Directory does not exist, create it.
        await fs.mkdir(rootPath, { recursive: true });
      } catch (error) {
        throw new Error(
          `An error occurred creating directory at: ${rootPath}.\nError: ${JSON.stringify(
            error
          )}`
        );
      }
    }

    // Clean up orphaned temp files left by interrupted atomic writes.
    try {
      const entries = await fs.readdir(rootPath);
      await Promise.all(
        entries
          .filter((file) => file.endsWith(".tmp"))
          .map((tempFile) =>
            fs.unlink(path.join(rootPath, tempFile)).catch(() => {})
          )
      );
    } catch {
      // Ignore cleanup errors.
    }

    return new this({ rootPath });
  }

  /**
   * Ensures calls for the same key run sequentially by chaining promises.
   * @param key Key to serialize operations for.
   * @param fn Async work to execute while the lock is held.
   * @returns Promise resolving with the callback result once the lock releases.
   */
  private async withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.keyLocks.get(key) ?? Promise.resolve();
    const waitForPrevious = previous.catch(() => {});

    let resolveCurrent: (() => void) | undefined;
    const current = new Promise<void>((resolve) => {
      resolveCurrent = resolve;
    });

    const tail = waitForPrevious.then(() => current);
    this.keyLocks.set(key, tail);

    await waitForPrevious;
    try {
      return await fn();
    } finally {
      resolveCurrent?.();
      if (this.keyLocks.get(key) === tail) {
        this.keyLocks.delete(key);
      }
    }
  }

  /**
   * Writes data to a temporary file before atomically renaming it into place.
   * @param content Serialized value to persist.
   * @param fullPath Destination path for the stored key.
   */
  private async writeFileAtomically(content: Uint8Array, fullPath: string) {
    const directory = path.dirname(fullPath);
    await fs.mkdir(directory, { recursive: true });

    const tempPath = `${fullPath}.${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.tmp`;

    try {
      await fs.writeFile(tempPath, content);

      try {
        await fs.rename(tempPath, fullPath);
      } catch (renameError) {
        const code = (renameError as { code?: string }).code;
        if (renameError && (code === "EPERM" || code === "EACCES")) {
          await fs.writeFile(fullPath, content);
          await fs.unlink(tempPath).catch(() => {});
        } else {
          throw renameError;
        }
      }
    } catch (error) {
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }
}
