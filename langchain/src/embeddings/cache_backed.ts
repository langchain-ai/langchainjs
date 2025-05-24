import { insecureHash } from "@langchain/core/utils/hash";
import {
  type EmbeddingsInterface,
  Embeddings,
} from "@langchain/core/embeddings";
import { BaseStore } from "@langchain/core/stores";

import { AsyncCallerParams } from "@langchain/core/utils/async_caller";
import { EncoderBackedStore } from "../storage/encoder_backed.js";

/**
 * Interface for the fields required to initialize an instance of the
 * CacheBackedEmbeddings class.
 */
export interface CacheBackedEmbeddingsFields extends AsyncCallerParams {
  underlyingEmbeddings: EmbeddingsInterface;
  documentEmbeddingStore: BaseStore<string, number[]>;
  queryEmbeddingStore?: BaseStore<string, number[]>;
}

/**
 * Interface for caching results from embedding models.
 *
 * The interface allows works with any store that implements
 * the abstract store interface accepting keys of type str and values of list of
 * floats.
 *
 * If need be, the interface can be extended to accept other implementations
 * of the value serializer and deserializer, as well as the key encoder.
 *
 * To enable query caching, pass a `queryEmbeddingStore` when initializing.
 *
 * @example
 * ```typescript
 * const underlyingEmbeddings = new OpenAIEmbeddings();
 *
 * const cacheBackedEmbeddings = CacheBackedEmbeddings.fromBytesStore(
 *   underlyingEmbeddings,
 *   new ConvexKVStore({ ctx }),
 *   {
 *     namespace: underlyingEmbeddings.modelName,
 *     queryEmbeddingStore: new ConvexKVStore({ ctx })
 *   },
 * );
 *
 * const loader = new TextLoader("./state_of_the_union.txt");
 * const rawDocuments = await loader.load();
 * const splitter = new RecursiveCharacterTextSplitter({
 *   chunkSize: 1000,
 *   chunkOverlap: 0,
 * });
 * const documents = await splitter.splitDocuments(rawDocuments);
 *
 * let time = Date.now();
 * const vectorstore = await ConvexVectorStore.fromDocuments(
 *   documents,
 *   cacheBackedEmbeddings,
 *   { ctx },
 * );
 * console.log(`Initial creation time: ${Date.now() - time}ms`);
 *
 * time = Date.now();
 * const vectorstore2 = await ConvexVectorStore.fromDocuments(
 *   documents,
 *   cacheBackedEmbeddings,
 *   { ctx },
 * );
 * console.log(`Cached creation time: ${Date.now() - time}ms`);
 *
 * ```
 */
export class CacheBackedEmbeddings extends Embeddings {
  protected underlyingEmbeddings: EmbeddingsInterface;

  protected documentEmbeddingStore: BaseStore<string, number[]>;

  protected queryEmbeddingStore?: BaseStore<string, number[]>;

  constructor(fields: CacheBackedEmbeddingsFields) {
    super(fields);
    this.underlyingEmbeddings = fields.underlyingEmbeddings;
    this.documentEmbeddingStore = fields.documentEmbeddingStore;
    this.queryEmbeddingStore = fields.queryEmbeddingStore;
  }

  /**
   * Embed query text.
   *
   * If a query embedding is already in cache, it is retrieved rather than recomputed.
   * If missing, the query is embedded, stored, and returned.
   *
   * @param document The query text to embed.
   * @returns The embedding vector for the query text.
   */
  async embedQuery(document: string): Promise<number[]> {
    if (this.queryEmbeddingStore) {
      const cachedEmbedding = await this.queryEmbeddingStore.mget([document]);
      if (cachedEmbedding[0]) {
        return cachedEmbedding[0];
      }
      const embedding = await this.underlyingEmbeddings.embedQuery(document);
      await this.queryEmbeddingStore.mset([[document, embedding]]);
      return embedding;
    }
    return this.underlyingEmbeddings.embedQuery(document);
  }

  /**
   * Embed a list of texts.
   *
   * The method first checks the cache for the embeddings.
   * If the embeddings are not found, the method uses the underlying embedder
   * to embed the documents and stores the results in the cache.
   *
   * @param documents
   * @returns A list of embeddings for the given texts.
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const vectors = await this.documentEmbeddingStore.mget(documents);
    const missingIndices: number[] = [];
    const missingDocuments: string[] = [];
    for (let i = 0; i < vectors.length; i++) {
      if (vectors[i] === undefined) {
        missingIndices.push(i);
        missingDocuments.push(documents[i]);
      }
    }
    if (missingDocuments.length) {
      const missingVectors = await this.underlyingEmbeddings.embedDocuments(
        missingDocuments
      );
      const keyValuePairs: [string, number[]][] = missingDocuments.map(
        (document, i) => [document, missingVectors[i]]
      );
      await this.documentEmbeddingStore.mset(keyValuePairs);
      for (let i = 0; i < missingIndices.length; i++) {
        vectors[missingIndices[i]] = missingVectors[i];
      }
    }
    return vectors as number[][];
  }

  /**
   * Create a new CacheBackedEmbeddings instance from another embeddings instance
   * and a storage instance.
   * @param underlyingEmbeddings Embeddings used to populate the cache for new documents.
   * @param documentEmbeddingStore Stores raw document embedding values. Keys are hashes of the document content.
   * @param options.namespace Optional namespace for store keys.
   * @param options.queryEmbeddingStore Optional cache for query embeddings.
   * @returns A new CacheBackedEmbeddings instance.
   */
  static fromBytesStore(
    underlyingEmbeddings: EmbeddingsInterface,
    documentEmbeddingStore: BaseStore<string, Uint8Array>,
    options?: {
      namespace?: string;
      queryEmbeddingStore?: BaseStore<string, Uint8Array>;
    }
  ) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const documentEncoderBackedStore = new EncoderBackedStore<
      string,
      number[],
      Uint8Array
    >({
      store: documentEmbeddingStore,
      keyEncoder: (key) => (options?.namespace ?? "") + insecureHash(key),
      valueSerializer: (value) => encoder.encode(JSON.stringify(value)),
      valueDeserializer: (serializedValue) =>
        JSON.parse(decoder.decode(serializedValue)),
    });
    const queryEncoderBackedStore = options?.queryEmbeddingStore
      ? new EncoderBackedStore<string, number[], Uint8Array>({
          store: options.queryEmbeddingStore,
          keyEncoder: (key) => (options?.namespace ?? "") + insecureHash(key),
          valueSerializer: (value) => encoder.encode(JSON.stringify(value)),
          valueDeserializer: (serializedValue) =>
            JSON.parse(decoder.decode(serializedValue)),
        })
      : undefined;
    return new this({
      underlyingEmbeddings,
      documentEmbeddingStore: documentEncoderBackedStore,
      queryEmbeddingStore: queryEncoderBackedStore,
    });
  }
}
