import { Serializable } from "../load/serializable.js";

/**
 * Abstract interface for a key-value store.
 */
export abstract class BaseStore<K, V> extends Serializable {
  abstract mget(keys: K[]): Promise<(V | undefined)[]>;

  abstract mset(keyValuePairs: [K, V][]): Promise<void>;

  abstract mdelete(keys: K[]): Promise<void>;

  abstract yieldKeys(prefix?: string): AsyncGenerator<K | string>;
}
