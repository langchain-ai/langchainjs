import { BaseStore } from "../schema/storage.js";
import { Document } from "../document.js";

/**
 * Class that provides a layer of abstraction over the base storage,
 * allowing for the encoding and decoding of keys and values. It extends
 * the BaseStore class.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EncoderBackedStore<K, V, SerializedType = any> extends BaseStore<
  K,
  V
> {
  lc_namespace = ["langchain", "storage"];

  store: BaseStore<string, SerializedType>;

  keyEncoder: (key: K) => string;

  valueSerializer: (value: V) => SerializedType;

  valueDeserializer: (value: SerializedType) => V;

  constructor(fields: {
    store: BaseStore<string, SerializedType>;
    keyEncoder: (key: K) => string;
    valueSerializer: (value: V) => SerializedType;
    valueDeserializer: (value: SerializedType) => V;
  }) {
    super(fields);
    this.store = fields.store;
    this.keyEncoder = fields.keyEncoder;
    this.valueSerializer = fields.valueSerializer;
    this.valueDeserializer = fields.valueDeserializer;
  }

  /**
   * Method to get multiple keys at once. It works with the encoded keys and
   * serialized values.
   * @param keys Array of keys to get
   * @returns Promise that resolves with an array of values or undefined for each key
   */
  async mget(keys: K[]): Promise<(V | undefined)[]> {
    const encodedKeys = keys.map(this.keyEncoder);
    const values = await this.store.mget(encodedKeys);
    return values.map((value) => {
      if (value === undefined) {
        return undefined;
      }
      return this.valueDeserializer(value);
    });
  }

  /**
   * Method to set multiple keys at once. It works with the encoded keys and
   * serialized values.
   * @param keyValuePairs Array of key-value pairs to set
   * @returns Promise that resolves when the operation is complete
   */
  async mset(keyValuePairs: [K, V][]): Promise<void> {
    const encodedPairs: [string, SerializedType][] = keyValuePairs.map(
      ([key, value]) => [this.keyEncoder(key), this.valueSerializer(value)]
    );
    return this.store.mset(encodedPairs);
  }

  /**
   * Method to delete multiple keys at once. It works with the encoded keys.
   * @param keys Array of keys to delete
   * @returns Promise that resolves when the operation is complete
   */
  async mdelete(keys: K[]): Promise<void> {
    const encodedKeys = keys.map(this.keyEncoder);
    return this.store.mdelete(encodedKeys);
  }

  /**
   * Method to yield keys. It works with the encoded keys.
   * @param prefix Optional prefix to filter keys
   * @returns AsyncGenerator that yields keys
   */
  async *yieldKeys(prefix?: string | undefined): AsyncGenerator<string | K> {
    yield* this.store.yieldKeys(prefix);
  }
}

export function createDocumentStoreFromByteStore(
  store: BaseStore<string, Uint8Array>
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new EncoderBackedStore({
    store,
    keyEncoder: (key: string) => key,
    valueSerializer: (doc: Document) =>
      encoder.encode(
        JSON.stringify({ pageContent: doc.pageContent, metadata: doc.metadata })
      ),
    valueDeserializer: (bytes: Uint8Array) =>
      new Document(JSON.parse(decoder.decode(bytes))),
  });
}
