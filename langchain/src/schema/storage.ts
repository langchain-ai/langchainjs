import { Serializable } from "../load/serializable.js";

/**
 * Abstract interface for a key-value store.
 */
export abstract class BaseStore<K, V> extends Serializable {
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
