import { insecureHash } from "./utils/hash.js";
import type { Generation, ChatGeneration } from "./outputs.js";
import {
  type StoredGeneration,
  mapStoredMessageToChatMessage,
} from "./messages/index.js";

/**
 * This cache key should be consistent across all versions of langchain.
 * It is currently NOT consistent across versions of langchain.
 *
 * A huge benefit of having a remote cache (like redis) is that you can
 * access the cache from different processes/machines. The allows you to
 * seperate concerns and scale horizontally.
 *
 * TODO: Make cache key consistent across versions of langchain.
 */
export const getCacheKey = (...strings: string[]): string =>
  insecureHash(strings.join("_"));

export function deserializeStoredGeneration(
  storedGeneration: StoredGeneration
) {
  if (storedGeneration.message !== undefined) {
    return {
      text: storedGeneration.text,
      message: mapStoredMessageToChatMessage(storedGeneration.message),
    };
  } else {
    return { text: storedGeneration.text };
  }
}

export function serializeGeneration(generation: Generation) {
  const serializedValue: StoredGeneration = {
    text: generation.text,
  };
  if ((generation as ChatGeneration).message !== undefined) {
    serializedValue.message = (generation as ChatGeneration).message.toDict();
  }
  return serializedValue;
}

/**
 * Base class for all caches. All caches should extend this class.
 */
export abstract class BaseCache<T = Generation[]> {
  abstract lookup(prompt: string, llmKey: string): Promise<T | null>;

  abstract update(prompt: string, llmKey: string, value: T): Promise<void>;
}

const GLOBAL_MAP = new Map();

/**
 * A cache for storing LLM generations that stores data in memory.
 */
export class InMemoryCache<T = Generation[]> extends BaseCache<T> {
  private cache: Map<string, T>;

  constructor(map?: Map<string, T>) {
    super();
    this.cache = map ?? new Map();
  }

  /**
   * Retrieves data from the cache using a prompt and an LLM key. If the
   * data is not found, it returns null.
   * @param prompt The prompt used to find the data.
   * @param llmKey The LLM key used to find the data.
   * @returns The data corresponding to the prompt and LLM key, or null if not found.
   */
  lookup(prompt: string, llmKey: string): Promise<T | null> {
    return Promise.resolve(this.cache.get(getCacheKey(prompt, llmKey)) ?? null);
  }

  /**
   * Updates the cache with new data using a prompt and an LLM key.
   * @param prompt The prompt used to store the data.
   * @param llmKey The LLM key used to store the data.
   * @param value The data to be stored.
   */
  async update(prompt: string, llmKey: string, value: T): Promise<void> {
    this.cache.set(getCacheKey(prompt, llmKey), value);
  }

  /**
   * Returns a global instance of InMemoryCache using a predefined global
   * map as the initial cache.
   * @returns A global instance of InMemoryCache.
   */
  static global(): InMemoryCache {
    return new InMemoryCache(GLOBAL_MAP);
  }
}
