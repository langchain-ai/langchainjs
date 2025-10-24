import { Serializable } from "./load/serializable.js";

/** @deprecated For backwards compatibility only. Remove on next minor version upgrade. */
export interface BaseStoreInterface<K, V> {
  /**
   * Method to get multiple values for a set of keys.
   * @param {K[]} keys - An array of keys.
   * @returns {Promise<(V | undefined)[]>} - A Promise that resolves with array of values or undefined if key not found.
   */
  mget(keys: K[]): Promise<(V | undefined)[]>;

  /**
   * Method to set a value for multiple keys.
   * @param {[K, V][]} keyValuePairs - An array of key-value pairs.
   * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
   */
  mset(keyValuePairs: [K, V][]): Promise<void>;

  /**
   * Method to delete multiple keys.
   * @param {K[]} keys - An array of keys to delete.
   * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
   */
  mdelete(keys: K[]): Promise<void>;

  /**
   * Method to yield keys optionally based on a prefix.
   * @param {string} prefix - Optional prefix to filter keys.
   * @returns {AsyncGenerator<K | string>} - An asynchronous generator that yields keys on iteration.
   */
  yieldKeys(prefix?: string): AsyncGenerator<K | string>;
}

/**
 * Abstract interface for a key-value store.
 */
export abstract class BaseStore<K, V>
  extends Serializable
  implements BaseStoreInterface<K, V>
{
  /**
   * Abstract method to get multiple values for a set of keys.
   * @param {K[]} keys - An array of keys.
   * @returns {Promise<(V | undefined)[]>} - A Promise that resolves with array of values or undefined if key not found.
   */
  abstract mget(keys: K[]): Promise<(V | undefined)[]>;

  /**
   * Abstract method to set a value for multiple keys.
   * @param {[K, V][]} keyValuePairs - An array of key-value pairs.
   * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
   */
  abstract mset(keyValuePairs: [K, V][]): Promise<void>;

  /**
   * Abstract method to delete multiple keys.
   * @param {K[]} keys - An array of keys to delete.
   * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
   */
  abstract mdelete(keys: K[]): Promise<void>;

  /**
   * Abstract method to yield keys optionally based on a prefix.
   * @param {string} prefix - Optional prefix to filter keys.
   * @returns {AsyncGenerator<K | string>} - An asynchronous generator that yields keys on iteration.
   */
  abstract yieldKeys(prefix?: string): AsyncGenerator<K | string>;
}

/**
 * In-memory implementation of the BaseStore using a dictionary. Used for
 * storing key-value pairs in memory.
 * @example
 * ```typescript
 * const store = new InMemoryStore<BaseMessage>();
 * await store.mset(
 *   Array.from({ length: 5 }).map((_, index) => [
 *     `message:id:${index}`,
 *     index % 2 === 0
 *       ? new AIMessage("ai stuff...")
 *       : new HumanMessage("human stuff..."),
 *   ]),
 * );
 *
 * const retrievedMessages = await store.mget(["message:id:0", "message:id:1"]);
 * await store.mdelete(await store.yieldKeys("message:id:").toArray());
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class InMemoryStore<T = any> extends BaseStore<string, T> {
  lc_namespace = ["langchain", "storage"];

  protected store: Record<string, T> = {};

  /**
   * Retrieves the values associated with the given keys from the store.
   * @param keys Keys to retrieve values for.
   * @returns Array of values associated with the given keys.
   */
  async mget(keys: string[]) {
    return keys.map((key) => this.store[key]);
  }

  /**
   * Sets the values for the given keys in the store.
   * @param keyValuePairs Array of key-value pairs to set in the store.
   * @returns Promise that resolves when all key-value pairs have been set.
   */
  async mset(keyValuePairs: [string, T][]): Promise<void> {
    for (const [key, value] of keyValuePairs) {
      this.store[key] = value;
    }
  }

  /**
   * Deletes the given keys and their associated values from the store.
   * @param keys Keys to delete from the store.
   * @returns Promise that resolves when all keys have been deleted.
   */
  async mdelete(keys: string[]): Promise<void> {
    for (const key of keys) {
      delete this.store[key];
    }
  }

  /**
   * Asynchronous generator that yields keys from the store. If a prefix is
   * provided, it only yields keys that start with the prefix.
   * @param prefix Optional prefix to filter keys.
   * @returns AsyncGenerator that yields keys from the store.
   */
  async *yieldKeys(prefix?: string | undefined): AsyncGenerator<string> {
    const keys = Object.keys(this.store);
    for (const key of keys) {
      if (prefix === undefined || key.startsWith(prefix)) {
        yield key;
      }
    }
  }
}
