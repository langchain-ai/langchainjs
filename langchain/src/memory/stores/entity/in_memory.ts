import { BaseEntityStore } from "../../../schema/index.js";

/**
 * An entity store that keeps data in memory. It extends from the
 * `BaseEntityStore` class and is used to store and manage entities.
 */
export class InMemoryEntityStore extends BaseEntityStore {
  lc_namespace = ["langchain", "stores", "entity", "in_memory"];

  private store: Record<string, string | undefined>;

  constructor() {
    super();
    this.store = Object.create(null);
  }

  /**
   * Retrieves the value associated with the given key from the store. If
   * the key does not exist in the store, it returns the provided default
   * value.
   * @param key The key to retrieve the value for.
   * @param defaultValue The default value to return if the key does not exist in the store.
   * @returns The value associated with the key, or the default value if the key does not exist in the store.
   */
  async get(
    key: string,
    defaultValue: string | undefined
  ): Promise<string | undefined> {
    return key in this.store ? this.store[key] : defaultValue;
  }

  /**
   * Sets the value associated with the given key in the store.
   * @param key The key to set the value for.
   * @param value The value to set.
   */
  async set(key: string, value: string | undefined): Promise<void> {
    this.store[key] = value;
  }

  /**
   * Removes the key and its associated value from the store.
   * @param key The key to remove.
   */
  async delete(key: string): Promise<void> {
    delete this.store[key];
  }

  /**
   * Checks if a key exists in the store.
   * @param key The key to check.
   * @returns A boolean indicating whether the key exists in the store.
   */
  async exists(key: string): Promise<boolean> {
    return key in this.store;
  }

  /**
   * Removes all keys and their associated values from the store.
   */
  async clear(): Promise<void> {
    this.store = Object.create(null);
  }
}
