import { BaseCache, Generation } from "../schema/index.js";
import { getCacheKey } from "./base.js";
import path from "path";
import fs from "node:fs/promises";

const DEFAULT_CACHE_DIR = path.join(process.cwd(), ".langchain-cache");

/**
 * A cache that uses the local filesystem as the backing store.
 * This is useful for local development and testing. But it is not recommended for production use.
 */
export class FSCache extends BaseCache {
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
  public static async create(
    cacheDir: string = DEFAULT_CACHE_DIR
  ): Promise<FSCache> {
    const cache = new FSCache(cacheDir);
    await fs.mkdir(cacheDir, { recursive: true });
    return cache;
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
    const key = getCacheKey(prompt, llmKey) + ".json";
    try {
      const content = await fs.readFile(path.join(this.cacheDir, key));
      return JSON.parse(content.toString()) as Generation[];
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
    const key = getCacheKey(prompt, llmKey) + ".json";
    await fs.writeFile(
      path.join(this.cacheDir, key),
      JSON.stringify(generations)
    );
  }
}
