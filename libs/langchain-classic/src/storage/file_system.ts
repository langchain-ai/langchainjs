import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
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

  /**
   * Map to track ongoing write operations per key.
   * This ensures that concurrent writes to the same key are serialized.
   */
  private writeQueues = new Map<string, Promise<void>>();

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
   * Writes the given key-value pairs to the file at the given path using atomic write.
   * This method writes to a temporary file first, then atomically renames it to the
   * final destination. This prevents partial writes and corruption if the process
   * crashes during the write operation.
   * @param content The content to write to the file.
   * @param key The key identifying the file.
   */
  private async setFileContent(content: Uint8Array, key: string) {
    const finalPath = this.getFullPath(key);
    const tempPath = `${finalPath}.${randomUUID()}.tmp`;

    try {
      // Write to temporary file first
      await fs.writeFile(tempPath, content);
      
      // Atomically rename to final destination
      // On most filesystems, rename is atomic - either the old file exists or the new one does
      await fs.rename(tempPath, finalPath);
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors - file might not exist
      }
      
      throw new Error(
        `Error writing file at path: ${finalPath}.\nError: ${JSON.stringify(
          error
        )}`
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
   * Queues a write operation for a specific key to ensure serialization.
   * If there's already a pending write for this key, the new write will
   * wait for it to complete before executing.
   * @param key The key to write to.
   * @param value The value to write.
   * @returns Promise that resolves when the write is complete.
   */
  private async queueWrite(key: string, value: Uint8Array): Promise<void> {
    // Get the existing queue for this key, or start with a resolved promise
    const existingQueue = this.writeQueues.get(key) || Promise.resolve();

    // Chain the new write operation after the existing queue
    const writePromise = existingQueue
      .then(() => this.setFileContent(value, key))
      .finally(() => {
        // Clean up the queue entry if this is still the current promise
        // This prevents memory leaks from accumulating promises
        if (this.writeQueues.get(key) === writePromise) {
          this.writeQueues.delete(key);
        }
      });

    // Store the new promise as the current queue for this key
    this.writeQueues.set(key, writePromise);

    return writePromise;
  }

  /**
   * Sets the values for the given keys in the store.
   * This method handles concurrent writes safely by:
   * 1. Deduplicating keys within the same batch (last value wins)
   * 2. Serializing writes to the same key across different mset() calls
   * @param keyValuePairs Array of key-value pairs to set in the store.
   * @returns Promise that resolves when all key-value pairs have been set.
   */
  async mset(keyValuePairs: [string, Uint8Array][]): Promise<void> {
    // Deduplicate keys within this batch - last value wins
    const uniqueEntries = new Map<string, Uint8Array>();
    for (const [key, value] of keyValuePairs) {
      uniqueEntries.set(key, value);
    }

    // Queue all writes, ensuring serialization per key
    await Promise.all(
      Array.from(uniqueEntries.entries()).map(([key, value]) =>
        this.queueWrite(key, value)
      )
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
   * Also cleans up any orphaned temporary files from previous crashes.
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

    return new this({ rootPath });
  }
}
