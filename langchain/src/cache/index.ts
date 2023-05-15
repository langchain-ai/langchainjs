import { getCacheKey } from "./base.js";
import { Generation, BaseCache } from "../schema/index.js";

const GLOBAL_MAP = new Map();

export class InMemoryCache<T = Generation[]> extends BaseCache<T> {
  private cache: Map<string, T>;

  constructor(map?: Map<string, T>) {
    super();
    this.cache = map ?? new Map();
  }

  lookup(prompt: string, llmKey: string): Promise<T | null> {
    return Promise.resolve(this.cache.get(getCacheKey(prompt, llmKey)) ?? null);
  }

  async update(prompt: string, llmKey: string, value: T): Promise<void> {
    this.cache.set(getCacheKey(prompt, llmKey), value);
  }

  static global(): InMemoryCache {
    return new InMemoryCache(GLOBAL_MAP);
  }
}
