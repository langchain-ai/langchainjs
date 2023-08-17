import { BaseStore } from "../schema/storage.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class InMemoryStore<T = any> extends BaseStore<string, T> {
  lc_namespace = ["langchain", "storage", "in_memory"];

  protected store: Record<string, T> = {};

  async mget(keys: string[]) {
    return keys.map((key) => this.store[key]);
  }

  async mset(keyValuePairs: [string, T][]): Promise<void> {
    for (const [key, value] of keyValuePairs) {
      this.store[key] = value;
    }
  }

  async mdelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      delete this.store[key];
    }
  }

  async *yieldKeys(prefix?: string | undefined): AsyncGenerator<string> {
    const keys = Object.keys(this.store);
    for (const key of keys) {
      if (prefix === undefined || key.startsWith(prefix)) {
        yield key;
      }
    }
  }
}
