import type {
  createCluster,
  createClient,
  RediSearchSchema,
  SearchOptions,
} from "redis";
import { SchemaFieldTypes, VectorAlgorithms } from "redis";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

// Adapted from internal redis types which aren't exported
/**
 * @deprecated Install and import from the "@langchain/redis" integration package instead.
 * Type for creating a schema vector field. It includes the algorithm,
 * distance metric, and initial capacity.
 */
export type CreateSchemaVectorField<
  T extends VectorAlgorithms,
  A extends Record<string, unknown>
> = {
  ALGORITHM: T;
  DISTANCE_METRIC: "L2" | "IP" | "COSINE";
  INITIAL_CAP?: number;
} & A;
/**
 * @deprecated Install and import from the "@langchain/redis" integration package instead.
 * Type for creating a flat schema vector field. It extends
 * CreateSchemaVectorField with a block size property.
 */
export type CreateSchemaFlatVectorField = CreateSchemaVectorField<
  VectorAlgorithms.FLAT,
  {
    BLOCK_SIZE?: number;
  }
>;
/**
 * @deprecated Install and import from the "@langchain/redis" integration package instead.
 * Type for creating a HNSW schema vector field. It extends
 * CreateSchemaVectorField with M, EF_CONSTRUCTION, and EF_RUNTIME
 * properties.
 */
export type CreateSchemaHNSWVectorField = CreateSchemaVectorField<
  VectorAlgorithms.HNSW,
  {
    M?: number;
    EF_CONSTRUCTION?: number;
    EF_RUNTIME?: number;
  }
>;

type CreateIndexOptions = NonNullable<
  Parameters<ReturnType<typeof createClient>["ft"]["create"]>[3]
>;

/** @deprecated Install and import from the "@langchain/redis" integration package instead. */
export type RedisSearchLanguages = `${NonNullable<
  CreateIndexOptions["LANGUAGE"]
>}`;

/** @deprecated Install and import from the "@langchain/redis" integration package instead. */
export type RedisVectorStoreIndexOptions = Omit<
  CreateIndexOptions,
  "LANGUAGE"
> & { LANGUAGE?: RedisSearchLanguages };

/**
 * @deprecated Install and import from the "@langchain/redis" integration package instead.
 * Interface for the configuration of the RedisVectorStore. It includes
 * the Redis client, index name, index options, key prefix, content key,
 * metadata key, vector key, and filter.
 */
export interface RedisVectorStoreConfig {
  redisClient:
    | ReturnType<typeof createClient>
    | ReturnType<typeof createCluster>;
  indexName: string;
  indexOptions?: CreateSchemaFlatVectorField | CreateSchemaHNSWVectorField;
  createIndexOptions?: Omit<RedisVectorStoreIndexOptions, "PREFIX">; // PREFIX must be set with keyPrefix
  keyPrefix?: string;
  contentKey?: string;
  metadataKey?: string;
  vectorKey?: string;
  filter?: RedisVectorStoreFilterType;
}

/**
 * @deprecated Install and import from the "@langchain/redis" integration package instead.
 * Interface for the options when adding documents to the
 * RedisVectorStore. It includes keys and batch size.
 */
export interface RedisAddOptions {
  keys?: string[];
  batchSize?: number;
}

/**
 * @deprecated Install and import from the "@langchain/redis" integration package instead.
 * Type for the filter used in the RedisVectorStore. It is an array of
 * strings.
 */
export type RedisVectorStoreFilterType = string[];

/**
 * @deprecated Install and import from the "@langchain/redis" integration package instead.
 * Class representing a RedisVectorStore. It extends the VectorStore class
 * and includes methods for adding documents and vectors, performing
 * similarity searches, managing the index, and more.
 */
export class RedisVectorStore extends VectorStore {
  declare FilterType: RedisVectorStoreFilterType;

  private redisClient:
    | ReturnType<typeof createClient>
    | ReturnType<typeof createCluster>;

  indexName: string;

  indexOptions: CreateSchemaFlatVectorField | CreateSchemaHNSWVectorField;

  createIndexOptions: CreateIndexOptions;

  keyPrefix: string;

  contentKey: string;

  metadataKey: string;

  vectorKey: string;

  filter?: RedisVectorStoreFilterType;

  _vectorstoreType(): string {
    return "redis";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    _dbConfig: RedisVectorStoreConfig
  ) {
    super(embeddings, _dbConfig);

    this.redisClient = _dbConfig.redisClient;
    this.indexName = _dbConfig.indexName;
    this.indexOptions = _dbConfig.indexOptions ?? {
      ALGORITHM: VectorAlgorithms.HNSW,
      DISTANCE_METRIC: "COSINE",
    };
    this.keyPrefix = _dbConfig.keyPrefix ?? `doc:${this.indexName}:`;
    this.contentKey = _dbConfig.contentKey ?? "content";
    this.metadataKey = _dbConfig.metadataKey ?? "metadata";
    this.vectorKey = _dbConfig.vectorKey ?? "content_vector";
    this.filter = _dbConfig.filter;
    this.createIndexOptions = {
      ON: "HASH",
      PREFIX: this.keyPrefix,
      ...(_dbConfig.createIndexOptions as CreateIndexOptions),
    };
  }

  /**
   * Method for adding documents to the RedisVectorStore. It first converts
   * the documents to texts and then adds them as vectors.
   * @param documents The documents to add.
   * @param options Optional parameters for adding the documents.
   * @returns A promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[], options?: RedisAddOptions) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method for adding vectors to the RedisVectorStore. It checks if the
   * index exists and creates it if it doesn't, then adds the vectors in
   * batches.
   * @param vectors The vectors to add.
   * @param documents The documents associated with the vectors.
   * @param keys Optional keys for the vectors.
   * @param batchSize The size of the batches in which to add the vectors. Defaults to 1000.
   * @returns A promise that resolves when the vectors have been added.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    { keys, batchSize = 1000 }: RedisAddOptions = {}
  ) {
    if (!vectors.length || !vectors[0].length) {
      throw new Error("No vectors provided");
    }
    // check if the index exists and create it if it doesn't
    await this.createIndex(vectors[0].length);

    const info = await this.redisClient.ft.info(this.indexName);
    const lastKeyCount = parseInt(info.numDocs, 10) || 0;
    const multi = this.redisClient.multi();

    vectors.map(async (vector, idx) => {
      const key =
        keys && keys.length
          ? keys[idx]
          : `${this.keyPrefix}${idx + lastKeyCount}`;
      const metadata =
        documents[idx] && documents[idx].metadata
          ? documents[idx].metadata
          : {};

      multi.hSet(key, {
        [this.vectorKey]: this.getFloat32Buffer(vector),
        [this.contentKey]: documents[idx].pageContent,
        [this.metadataKey]: this.escapeSpecialChars(JSON.stringify(metadata)),
      });

      // write batch
      if (idx % batchSize === 0) {
        await multi.exec();
      }
    });

    // insert final batch
    await multi.exec();
  }

  /**
   * Method for performing a similarity search in the RedisVectorStore. It
   * returns the documents and their scores.
   * @param query The query vector.
   * @param k The number of nearest neighbors to return.
   * @param filter Optional filter to apply to the search.
   * @returns A promise that resolves to an array of documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: RedisVectorStoreFilterType
  ): Promise<[Document, number][]> {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }

    const _filter = filter ?? this.filter;
    const results = await this.redisClient.ft.search(
      this.indexName,
      ...this.buildQuery(query, k, _filter)
    );
    const result: [Document, number][] = [];

    if (results.total) {
      for (const res of results.documents) {
        if (res.value) {
          const document = res.value;
          if (document.vector_score) {
            result.push([
              new Document({
                pageContent: (document[this.contentKey] ?? "") as string,
                metadata: JSON.parse(
                  this.unEscapeSpecialChars(
                    (document.metadata ?? "{}") as string
                  )
                ),
              }),
              Number(document.vector_score),
            ]);
          }
        }
      }
    }

    return result;
  }

  /**
   * Static method for creating a new instance of RedisVectorStore from
   * texts. It creates documents from the texts and metadata, then adds them
   * to the RedisVectorStore.
   * @param texts The texts to add.
   * @param metadatas The metadata associated with the texts.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the RedisVectorStore.
   * @returns A promise that resolves to a new instance of RedisVectorStore.
   */
  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: RedisVectorStoreConfig
  ): Promise<RedisVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return RedisVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method for creating a new instance of RedisVectorStore from
   * documents. It adds the documents to the RedisVectorStore.
   * @param docs The documents to add.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the RedisVectorStore.
   * @returns A promise that resolves to a new instance of RedisVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: RedisVectorStoreConfig
  ): Promise<RedisVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Method for checking if an index exists in the RedisVectorStore.
   * @returns A promise that resolves to a boolean indicating whether the index exists.
   */
  async checkIndexExists() {
    try {
      await this.redisClient.ft.info(this.indexName);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.message.includes("unknown command")) {
        throw new Error(
          "Failed to run FT.INFO command. Please ensure that you are running a RediSearch-capable Redis instance: https://js.langchain.com/docs/modules/data_connection/vectorstores/integrations/redis#setup"
        );
      }
      // index doesn't exist
      return false;
    }

    return true;
  }

  /**
   * Method for creating an index in the RedisVectorStore. If the index
   * already exists, it does nothing.
   * @param dimensions The dimensions of the index
   * @returns A promise that resolves when the index has been created.
   */
  async createIndex(dimensions = 1536): Promise<void> {
    if (await this.checkIndexExists()) {
      return;
    }

    const schema: RediSearchSchema = {
      [this.vectorKey]: {
        type: SchemaFieldTypes.VECTOR,
        TYPE: "FLOAT32",
        DIM: dimensions,
        ...this.indexOptions,
      },
      [this.contentKey]: SchemaFieldTypes.TEXT,
      [this.metadataKey]: SchemaFieldTypes.TEXT,
    };

    await this.redisClient.ft.create(
      this.indexName,
      schema,
      this.createIndexOptions
    );
  }

  /**
   * Method for dropping an index from the RedisVectorStore.
   * @param deleteDocuments Optional boolean indicating whether to drop the associated documents.
   * @returns A promise that resolves to a boolean indicating whether the index was dropped.
   */
  async dropIndex(deleteDocuments?: boolean): Promise<boolean> {
    try {
      const options = deleteDocuments ? { DD: deleteDocuments } : undefined;
      await this.redisClient.ft.dropIndex(this.indexName, options);

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Deletes vectors from the vector store.
   * @param params The parameters for deleting vectors.
   * @returns A promise that resolves when the vectors have been deleted.
   */
  async delete(params: { deleteAll: boolean }): Promise<void> {
    if (params.deleteAll) {
      await this.dropIndex(true);
    } else {
      throw new Error(`Invalid parameters passed to "delete".`);
    }
  }

  private buildQuery(
    query: number[],
    k: number,
    filter?: RedisVectorStoreFilterType
  ): [string, SearchOptions] {
    const vectorScoreField = "vector_score";

    let hybridFields = "*";
    // if a filter is set, modify the hybrid query
    if (filter && filter.length) {
      // `filter` is a list of strings, then it's applied using the OR operator in the metadata key
      // for example: filter = ['foo', 'bar'] => this will filter all metadata containing either 'foo' OR 'bar'
      hybridFields = `@${this.metadataKey}:(${this.prepareFilter(filter)})`;
    }

    const baseQuery = `${hybridFields} => [KNN ${k} @${this.vectorKey} $vector AS ${vectorScoreField}]`;
    const returnFields = [this.metadataKey, this.contentKey, vectorScoreField];

    const options: SearchOptions = {
      PARAMS: {
        vector: this.getFloat32Buffer(query),
      },
      RETURN: returnFields,
      SORTBY: vectorScoreField,
      DIALECT: 2,
      LIMIT: {
        from: 0,
        size: k,
      },
    };

    return [baseQuery, options];
  }

  private prepareFilter(filter: RedisVectorStoreFilterType) {
    return filter.map(this.escapeSpecialChars).join("|");
  }

  /**
   * Escapes all '-' characters.
   * RediSearch considers '-' as a negative operator, hence we need
   * to escape it
   * @see https://redis.io/docs/stack/search/reference/query_syntax
   *
   * @param str
   * @returns
   */
  private escapeSpecialChars(str: string) {
    return str.replaceAll("-", "\\-");
  }

  /**
   * Unescapes all '-' characters, returning the original string
   *
   * @param str
   * @returns
   */
  private unEscapeSpecialChars(str: string) {
    return str.replaceAll("\\-", "-");
  }

  /**
   * Converts the vector to the buffer Redis needs to
   * correctly store an embedding
   *
   * @param vector
   * @returns Buffer
   */
  private getFloat32Buffer(vector: number[]) {
    return Buffer.from(new Float32Array(vector).buffer);
  }
}
