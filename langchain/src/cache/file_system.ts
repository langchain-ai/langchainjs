import path from "node:path";
import fs from "node:fs/promises";

import { BaseCache, Generation } from "../schema/index.js";
import {
  getCacheKey,
  serializeGeneration,
  deserializeStoredGeneration,
} from "./base.js";

/**
 * A cache that uses the local filesystem as the backing store.
 * This is useful for local development and testing. But it is not recommended for production use.
 */
export class LocalFileCache extends BaseCache {
  private cacheDir: string;

  private constructor(cacheDir: string) {
    super();
    this.cacheDir = cacheDir;
  }

  /**
   * Create a new cache backed by the local filesystem.
   * It ensures that the cache directory exists before returning.
   * @param cacheDir
   */
  public static async create(cacheDir?: string): Promise<LocalFileCache> {
    if (!cacheDir) {
      // eslint-disable-next-line no-param-reassign
      cacheDir = await fs.mkdtemp("langchain-cache-");
    } else {
      // ensure the cache directory exists
      await fs.mkdir(cacheDir, { recursive: true });
    }
    return new LocalFileCache(cacheDir);
  }

  /**
   * Retrieves data from the cache. It constructs a cache key from the given
   * `prompt` and `llmKey`, and retrieves the corresponding value from the
   * cache files.
   * @param prompt The prompt used to construct the cache key.
   * @param llmKey The LLM key used to construct the cache key.
   * @returns An array of Generations if found, null otherwise.
   */
  public async lookup(prompt: string, llmKey: string) {
    const key = `${getCacheKey(prompt, llmKey)}.json`;
    try {
      const content = await fs.readFile(path.join(this.cacheDir, key));
      return JSON.parse(content.toString()).map(deserializeStoredGeneration);
    } catch {
      return null;
    }
  }

  /**
   * Updates the cache with new data. It constructs a cache key from the
   * given `prompt` and `llmKey`, and stores the `value` in a specific
   * file in the cache directory.
   * @param prompt The prompt used to construct the cache key.
   * @param llmKey The LLM key used to construct the cache key.
   * @param generations The value to be stored in the cache.
   */
  public async update(
    prompt: string,
    llmKey: string,
    generations: Generation[]
  ) {
    const key = `${getCacheKey(prompt, llmKey)}.json`;
    await fs.writeFile(
      path.join(this.cacheDir, key),
      JSON.stringify(generations.map(serializeGeneration))
    );
  }
}
