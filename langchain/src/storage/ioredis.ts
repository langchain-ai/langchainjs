import type { Redis } from "ioredis";

import { BaseStore } from "../schema/storage.js";

/**
 * Class that extends the BaseStore class to interact with a Redis
 * database. It provides methods for getting, setting, and deleting data,
 * as well as yielding keys from the database.
 */
export class RedisByteStore extends BaseStore<string, Uint8Array> {
  lc_namespace = ["langchain", "storage", "ioredis"];

  protected client: Redis;

  protected ttl?: number;

  protected namespace?: string;

  protected yieldKeysScanBatchSize = 1000;

  constructor(fields: {
    client: Redis;
    ttl?: number;
    namespace?: string;
    yieldKeysScanBatchSize?: number;
  }) {
    super(fields);
    this.client = fields.client;
    this.ttl = fields.ttl;
    this.namespace = fields.namespace;
    this.yieldKeysScanBatchSize =
      fields.yieldKeysScanBatchSize ?? this.yieldKeysScanBatchSize;
  }

  _getPrefixedKey(key: string) {
    if (this.namespace) {
      const delimiter = "/";
      return `${this.namespace}${delimiter}${key}`;
    }
    return key;
  }

  _getDeprefixedKey(key: string) {
    if (this.namespace) {
      const delimiter = "/";
      return key.slice(this.namespace.length + delimiter.length);
    }
    return key;
  }

  /**
   * Gets multiple keys from the Redis database.
   * @param keys Array of keys to be retrieved.
   * @returns An array of retrieved values.
   */
  async mget(keys: string[]) {
    const prefixedKeys = keys.map(this._getPrefixedKey.bind(this));
    const retrievedValues = await this.client.mgetBuffer(prefixedKeys);
    return retrievedValues.map((key) => {
      if (!key) {
        return undefined;
      } else {
        return key;
      }
    });
  }

  /**
   * Sets multiple keys in the Redis database.
   * @param keyValuePairs Array of key-value pairs to be set.
   * @returns Promise that resolves when all keys have been set.
   */
  async mset(keyValuePairs: [string, Uint8Array][]): Promise<void> {
    const decoder = new TextDecoder();
    const encodedKeyValuePairs = keyValuePairs.map(([key, value]) => [
      this._getPrefixedKey(key),
      decoder.decode(value),
    ]);
    const pipeline = this.client.pipeline();
    for (const [key, value] of encodedKeyValuePairs) {
      if (this.ttl) {
        pipeline.set(key, value, "EX", this.ttl);
      } else {
        pipeline.set(key, value);
      }
    }
    await pipeline.exec();
  }

  /**
   * Deletes multiple keys from the Redis database.
   * @param keys Array of keys to be deleted.
   * @returns Promise that resolves when all keys have been deleted.
   */
  async mdelete(keys: string[]): Promise<void> {
    await this.client.del(...keys.map(this._getPrefixedKey.bind(this)));
  }

  /**
   * Yields keys from the Redis database.
   * @param prefix Optional prefix to filter the keys.
   * @returns An AsyncGenerator that yields keys from the Redis database.
   */
  async *yieldKeys(prefix?: string): AsyncGenerator<string> {
    let pattern;
    if (prefix) {
      pattern = this._getPrefixedKey(prefix);
    } else {
      pattern = this._getPrefixedKey("*");
    }
    let [cursor, batch] = await this.client.scan(
      0,
      "MATCH",
      pattern,
      "COUNT",
      this.yieldKeysScanBatchSize
    );
    for (const key of batch) {
      yield this._getDeprefixedKey(key);
    }
    while (cursor !== "0") {
      [cursor, batch] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        this.yieldKeysScanBatchSize
      );
      for (const key of batch) {
        yield this._getDeprefixedKey(key);
      }
    }
  }
}
