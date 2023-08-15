import type { Redis } from "ioredis";

import { BaseStore } from "../schema/storage.js";

export class RedisByteStore extends BaseStore<string, Uint8Array> {
  lc_namespace = ["langchain", "storage", "ioredis"];

  protected client: Redis;

  protected ttl?: number;

  protected namespace?: string;

  constructor(fields: { client: Redis; ttl?: number; namespace?: string }) {
    super(fields);
    this.client = fields.client;
    this.ttl = fields.ttl;
    this.namespace = fields.namespace;
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

  async mdelete(keys: string[]): Promise<void> {
    await this.client.del(...keys.map(this._getPrefixedKey.bind(this)));
  }

  async *yieldKeys(prefix?: string): AsyncGenerator<string> {
    let pattern;
    if (prefix) {
      pattern = this._getPrefixedKey(prefix);
    } else {
      pattern = this._getPrefixedKey("*");
    }
    const batchSize = 10;
    let [cursor, batch] = await this.client.scan(
      0,
      "MATCH",
      pattern,
      "COUNT",
      batchSize
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
        batchSize
      );
      for (const key of batch) {
        yield this._getDeprefixedKey(key);
      }
    }
  }
}
