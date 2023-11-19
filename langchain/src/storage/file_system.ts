import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BaseStore } from "../schema/storage.js";

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
 */
export class LocalFileStore extends BaseStore<string, Uint8Array> {
  lc_namespace = ["langchain", "storage"];

  rootPath: string;

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
    try {
      const fileContent = await fs.readFile(this.getFullPath(key));
      if (!fileContent) {
        return undefined;
      }
      return fileContent;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      // File does not exist yet.
      // eslint-disable-next-line no-instanceof/no-instanceof
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
    try {
      await fs.writeFile(this.getFullPath(key), content);
    } catch (error) {
      throw new Error(
        `Error writing file at path: ${this.getFullPath(
          key
        )}.\nError: ${JSON.stringify(error)}`
      );
    }
  }

  /**
   * Returns the full path of the file where the value of the given key is stored.
   * @param key the key to get the full path for
   */
  private getFullPath(key: string): string {
    try {
      const keyAsTxtFile = `${key}.txt`;
      const fullPath = path.join(this.rootPath, keyAsTxtFile);
      return fullPath;
    } catch (e) {
      throw new Error(
        `Error getting full path for key: ${key}.\nError: ${JSON.stringify(e)}`
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
   * @param keyValuePairs Array of key-value pairs to set in the store.
   * @returns Promise that resolves when all key-value pairs have been set.
   */
  async mset(keyValuePairs: [string, Uint8Array][]): Promise<void> {
    await Promise.all(
      keyValuePairs.map(([key, value]) => this.setFileContent(value, key))
    );
  }

  /**
   * Deletes the given keys and their associated values from the store.
   * @param keys Keys to delete from the store.
   * @returns Promise that resolves when all keys have been deleted.
   */
  async mdelete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => fs.unlink(this.getFullPath(key))));
  }

  /**
   * Asynchronous generator that yields keys from the store. If a prefix is
   * provided, it only yields keys that start with the prefix.
   * @param prefix Optional prefix to filter keys.
   * @returns AsyncGenerator that yields keys from the store.
   */
  async *yieldKeys(prefix?: string): AsyncGenerator<string> {
    const allFiles = await fs.readdir(this.rootPath);
    const allKeys = allFiles.map((file) => file.replace(".txt", ""));
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
    } catch (_) {
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

    return new this({ rootPath });
  }
}
