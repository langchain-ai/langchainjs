import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { BaseStore } from "../schema/storage.js";

/**
 * File system implementation of the BaseStore using a dictionary. Used for
 * storing key-value pairs in the file system.
 */
export class NodeFileSystemStore<T> extends BaseStore<string, T> {
  lc_namespace = ["langchain", "storage"];

  path: string;

  constructor(fields: { path: string }) {
    if (path.extname(fields.path) !== ".json") {
      throw new Error("File extension must be .json for NodeFileSystemStore");
    }

    super(fields);
    this.path = fields.path;
  }

  private async getParsedFile(): Promise<Record<string, T>> {
    if (fs.existsSync(this.path)) {
      if (fs.lstatSync(this.path).isDirectory()) {
        console.log(`${this.path} is a directory`);
        fs.rmdir(this.path, { recursive: true }, (err) => {
          console.error("error del dir", err);
        });
      } else {
        console.log(`${this.path} is a file`);
      }
    } else {
      console.log(`${this.path} does not exist`);
    }
    let values: Record<string, T> = {};
    try {
      const fileContent = await fsPromises.readFile(this.path, "utf-8");
      if (!fileContent) {
        return {} as Record<string, T>;
      }
      values = JSON.parse(fileContent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (("code" in e && e.code === "EISDIR") || e.code === "ENOENT") {
        await fsPromises.writeFile(this.path, "", "utf-8");
        return {} as Record<string, T>;
      }
      console.error(e);
      throw new Error(`Error parsing file content at path: ${this.path}`);
    }
    return values;
  }

  private async setFileContent(fileContent: Record<string, T>) {
    try {
      const fileContentString = JSON.stringify(fileContent);
      await fsPromises.writeFile(this.path, fileContentString, { flag: "a" });
    } catch (e) {
      throw new Error(`Error setting file content at path: ${this.path}`);
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
  async *yieldKeys(prefix?: string | undefined): AsyncGenerator<string> {
    const fileContent = await this.getParsedFile();
    const keys = Object.keys(fileContent);
    for (const key of keys) {
      if (prefix === undefined || key.startsWith(prefix)) {
        yield key;
      }
    }
  }
}
