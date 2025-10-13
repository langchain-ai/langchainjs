import { BaseStore } from "@langchain/core/stores";
import { Collection, Document as MongoDocument } from "mongodb";

/**
 * Type definition for the input parameters required to initialize an
 * instance of the MongoDBStoreInput class.
 */
export interface MongoDBStoreInput {
  collection: Collection<MongoDocument>;
  /**
   * The amount of keys to retrieve per batch when yielding keys.
   * @default 1000
   */
  yieldKeysScanBatchSize?: number;
  /**
   * The namespace to use for the keys in the database.
   */
  namespace?: string;
  /**
   * The primary key to use for the database.
   * @default "_id"
   */
  primaryKey?: string;
}

/**
 * Class that extends the BaseStore class to interact with a MongoDB
 * database. It provides methods for getting, setting, and deleting data,
 * as well as yielding keys from the database.
 * @example
 * ```typescript
 * const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
 * const collection = client.db("dbName").collection("collectionName");

 * const store = new MongoDBStore({
 *   collection,
 * });
 *
 * const docs = [
 *   [uuidv4(), "Dogs are tough."],
 *   [uuidv4(), "Cats are tough."],
 * ];
 * const encoder = new TextEncoder();
 * const docsAsKVPairs: Array<[string, Uint8Array]> = docs.map(
 *   (doc) => [doc[0], encoder.encode(doc[1])]
 * );
 * await store.mset(docsAsKVPairs);
 * ```
 */
export class MongoDBStore extends BaseStore<string, Uint8Array> {
  lc_namespace = ["langchain", "storage", "mongodb"];

  collection: Collection<MongoDocument>;

  protected namespace?: string;

  protected yieldKeysScanBatchSize = 1000;

  primaryKey = "_id";

  constructor(fields: MongoDBStoreInput) {
    super(fields);
    this.collection = fields.collection;
    this.primaryKey = fields.primaryKey ?? this.primaryKey;
    this.yieldKeysScanBatchSize =
      fields.yieldKeysScanBatchSize ?? this.yieldKeysScanBatchSize;
    this.namespace = fields.namespace;
    this.collection.db.client.appendMetadata({
      name: "langchainjs_storage",
    });
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
   * Gets multiple keys from the MongoDB database.
   * @param keys Array of keys to be retrieved.
   * @returns An array of retrieved values.
   */
  async mget(keys: string[]) {
    const prefixedKeys = keys.map(this._getPrefixedKey.bind(this));
    const retrievedValues = await this.collection
      .find({
        [this.primaryKey]: { $in: prefixedKeys },
      })
      .toArray();

    const encoder = new TextEncoder();
    const valueMap = new Map(
      retrievedValues.map((item) => [item[this.primaryKey], item])
    );

    return prefixedKeys.map((prefixedKey) => {
      const value = valueMap.get(prefixedKey);

      if (!value) {
        return undefined;
      }

      if (!("value" in value)) {
        return undefined;
      } else if (typeof value.value === "object") {
        return encoder.encode(JSON.stringify(value.value));
      } else if (typeof value.value === "string") {
        return encoder.encode(value.value);
      } else {
        throw new Error("Unexpected value type");
      }
    });
  }

  /**
   * Sets multiple keys in the MongoDB database.
   * @param keyValuePairs Array of key-value pairs to be set.
   * @returns Promise that resolves when all keys have been set.
   */
  async mset(keyValuePairs: [string, Uint8Array][]): Promise<void> {
    const decoder = new TextDecoder();

    const updates = keyValuePairs.map(([key, value]) => {
      const decodedValue = decoder.decode(value);
      return [
        { [this.primaryKey]: this._getPrefixedKey(key) },
        {
          $set: {
            [this.primaryKey]: this._getPrefixedKey(key),
            ...{ value: decodedValue },
          },
        },
      ];
    });
    await this.collection.bulkWrite(
      updates.map(([filter, update]) => ({
        updateOne: {
          filter,
          update,
          upsert: true,
        },
      }))
    );
  }

  /**
   * Deletes multiple keys from the MongoDB database.
   * @param keys Array of keys to be deleted.
   * @returns Promise that resolves when all keys have been deleted.
   */
  async mdelete(keys: string[]): Promise<void> {
    const allKeysWithPrefix = keys.map(this._getPrefixedKey.bind(this));
    await this.collection.deleteMany({
      [this.primaryKey]: { $in: allKeysWithPrefix },
    });
  }

  /**
   * Yields keys from the MongoDB database.
   * @param prefix Optional prefix to filter the keys. A wildcard (*) is always appended to the end.
   * @returns An AsyncGenerator that yields keys from the MongoDB database.
   */
  async *yieldKeys(prefix?: string): AsyncGenerator<string> {
    let regexPattern;
    if (prefix) {
      // Convert wildcard (*) to regex equivalent (.*)
      // Escape special regex characters in prefix to ensure they are treated as literals
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regexPrefix = escapedPrefix.endsWith("*")
        ? escapedPrefix.slice(0, -1)
        : escapedPrefix;
      regexPattern = `^${this._getPrefixedKey(regexPrefix)}.*`;
    } else {
      regexPattern = `^${this._getPrefixedKey(".*")}`;
    }

    const cursor = this.collection
      .find(
        {
          [this.primaryKey]: { $regex: regexPattern },
        },
        {
          batchSize: this.yieldKeysScanBatchSize,
        }
      )
      .map((key) => this._getDeprefixedKey(key[this.primaryKey]));

    for await (const document of cursor) {
      yield document;
    }
  }
}
