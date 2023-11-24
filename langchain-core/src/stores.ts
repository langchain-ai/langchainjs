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
