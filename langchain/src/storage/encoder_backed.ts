import { BaseStore } from "../schema/storage.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EncoderBackedStore<K, V, SerializedType = any> extends BaseStore<
  K,
  V
> {
  lc_namespace = ["langchain", "storage", "encoder_backed"];

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

  async mset(keyValuePairs: [K, V][]): Promise<void> {
    const encodedPairs: [string, SerializedType][] = keyValuePairs.map(
      ([key, value]) => [this.keyEncoder(key), this.valueSerializer(value)]
    );
    return this.store.mset(encodedPairs);
  }

  async mdelete(keys: K[]): Promise<void> {
    const encodedKeys = keys.map(this.keyEncoder);
    return this.store.mdelete(encodedKeys);
  }

  async *yieldKeys(prefix?: string | undefined): AsyncGenerator<string | K> {
    yield* this.store.yieldKeys(prefix);
  }
}
