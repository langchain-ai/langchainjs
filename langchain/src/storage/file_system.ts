import { promises as fsPromises } from "fs";
import path from "path";
import { BaseStore } from "../schema/storage.js";

/**
 * File system implementation of the BaseStore using a dictionary. Used for
 * storing key-value pairs in the file system.
 */
export class LocalFileStore<T> extends BaseStore<string, T> {
  lc_namespace = ["langchain", "storage"];

  path: string;

  constructor(fields: { path: string }) {
    if (path.extname(fields.path) !== ".json") {
      throw new Error(
        `File extension must be .json for LocalFileStore. Path: ${fields.path}`
      );
    }

    super(fields);
    this.path = fields.path;
  }

  /**
   * Read and parse the file at the given path.
   * @returns Promise that resolves to the parsed file content.
   */
  private async getParsedFile(): Promise<Record<string, T>> {
    let values: Record<string, T> = {};
    try {
      const fileContent = await fsPromises.readFile(this.path, "utf-8");
      if (!fileContent) {
        return {} as Record<string, T>;
      }
      values = JSON.parse(fileContent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      // If the file does not exist, create it
      if (("code" in e && e.code === "EISDIR") || e.code === "ENOENT") {
        await fsPromises.writeFile(this.path, "", "utf-8");
        return {} as Record<string, T>;
      }
      throw new Error(
        `Error reading and parsing file at path: ${
          this.path
        }.\nError: ${JSON.stringify(e)}`
      );
    }
    return values;
  }

  /**
   * Writes the given key-value pairs to the file at the given path.
   * @param fileContent An object with the key-value pairs to be written to the file.
   */
  private async setFileContent(fileContent: Record<string, T>) {
    try {
      const hasEntries = Object.entries(fileContent).length > 0;
      const fileContentString = hasEntries ? JSON.stringify(fileContent) : "";
      await fsPromises.writeFile(this.path, fileContentString);
    } catch (error) {
      throw new Error(
        `Error writing file at path: ${this.path}.\nError: ${JSON.stringify(
          error
        )}`
      );
    }
  }

  /**
   * Retrieves the values associated with the given keys from the store.
   * @param keys Keys to retrieve values for.
   * @returns Array of values associated with the given keys.
   */
  async mget(keys: string[]) {
    const fileContent = await this.getParsedFile();
    const retrievedValues = Object.entries(fileContent)
      .filter(([key]) => keys.includes(key))
      .map(([_, value]) => value);
    return retrievedValues;
  }

  /**
   * Sets the values for the given keys in the store.
   * @param keyValuePairs Array of key-value pairs to set in the store.
   * @returns Promise that resolves when all key-value pairs have been set.
   */
  async mset(keyValuePairs: [string, T][]): Promise<void> {
    const fileContent = await this.getParsedFile();
    const encodedKeyValuePairs: [string, T][] = keyValuePairs.map(
      ([key, value]) => [key, value]
    );

    for (const [key, value] of encodedKeyValuePairs) {
      fileContent[key] = value;
    }
    await this.setFileContent(fileContent);
  }

  /**
   * Deletes the given keys and their associated values from the store.
   * @param keys Keys to delete from the store.
   * @returns Promise that resolves when all keys have been deleted.
   */
  async mdelete(keys: string[]): Promise<void> {
    const fileContent = await this.getParsedFile();
    for (const key of keys) {
      delete fileContent[key];
    }
    await this.setFileContent(fileContent);
  }

  /**
   * Asynchronous generator that yields keys from the store. If a prefix is
   * provided, it only yields keys that start with the prefix.
   * @param prefix Optional prefix to filter keys.
   * @returns AsyncGenerator that yields keys from the store.
   */
  async *yieldKeys(prefix?: string): AsyncGenerator<string> {
    const fileContent = await this.getParsedFile();
    const keys = Object.keys(fileContent);
    for (const key of keys) {
      if (prefix === undefined || key.startsWith(prefix)) {
        yield key;
      }
    }
  }

  /**
   * Static method for initializing the class.
   * Preforms a check to see if the file exists, and if not, creates it.
   * @param path Path to the file.
   * @returns Promise that resolves to an instance of the class.
   */
  static async fromPath<T>(path: string): Promise<LocalFileStore<T>> {
    try {
      // Verifies the file exists at the provided path, and that it is readable and writable.
      await fsPromises.access(
        path,
        fsPromises.constants.R_OK | fsPromises.constants.W_OK
      );
    } catch (_) {
      try {
        // File does not exist, create it.
        await fsPromises.writeFile(path, "", { flag: "a" });
      } catch (error) {
        throw new Error(
          `An error occurred creating file at: ${path}.\nError: ${JSON.stringify(
            error
          )}`
        );
      }
    }

    return new this<T>({ path });
  }
}
