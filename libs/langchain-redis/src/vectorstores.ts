import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import type {
  createClient,
  createCluster,
  RediSearchSchema,
  SearchOptions,
} from "redis";
import { SchemaFieldTypes, VectorAlgorithms } from "redis";

// Adapated from internal redis types which aren't exported
/**
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

export type RedisSearchLanguages = `${NonNullable<
  CreateIndexOptions["LANGUAGE"]
>}`;

export type RedisVectorStoreIndexOptions = Omit<
  CreateIndexOptions,
  "LANGUAGE"
> & {
  LANGUAGE?: RedisSearchLanguages;
};

/**
 * Interface for custom schema field definitions
 */
export interface CustomSchemaField {
  type: SchemaFieldTypes;
  required?: boolean;
  SORTABLE?: boolean | "UNF";
  NOINDEX?: boolean;
  SEPARATOR?: string; // For TAG fields
  CASESENSITIVE?: true; // For TAG fields (Redis expects true, not boolean)
  NOSTEM?: true; // For TEXT fields (Redis expects true, not boolean)
  WEIGHT?: number; // For TEXT fields
}

/**
 * Interface for the configuration of the RedisVectorStore. It includes
 * the Redis client, index name, index options, key prefix, content key,
 * metadata key, vector key, filter and ttl.
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
  ttl?: number; // ttl in second
  customSchema?: Record<string, CustomSchemaField>; // Custom schema fields for metadata
}

/**
 * Interface for the options when adding documents to the
 * RedisVectorStore. It includes keys and batch size.
 */
export interface RedisAddOptions {
  keys?: string[];
  batchSize?: number;
}

/**
 * Type for the filter used in the RedisVectorStore. It is an array of
 * strings.
 * If a string is passed instead of an array the value is used directly, this
 * allows custom filters to be passed.
 */
export type RedisVectorStoreFilterType = string[] | string;

/**
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

  ttl?: number;

  customSchema?: Record<string, CustomSchemaField>;

  _vectorstoreType(): string {
    return "redis";
  }

  /**
   * Validates metadata against the custom schema if defined
   * @param metadata The metadata object to validate
   * @throws Error if validation fails
   */
  private validateMetadata(metadata: Record<string, unknown>): void {
    if (!this.customSchema) {
      return; // No schema defined, skip validation
    }

    for (const [fieldName, fieldConfig] of Object.entries(this.customSchema)) {
      const value = metadata[fieldName];

      // Check if required field is missing
      if (fieldConfig.required && (value === undefined || value === null)) {
        throw new Error(`Required metadata field '${fieldName}' is missing`);
      }

      // Skip validation for optional fields that are not provided
      if (value === undefined || value === null) {
        continue;
      }

      // Basic type validation based on schema field type
      switch (fieldConfig.type) {
        case SchemaFieldTypes.NUMERIC:
          if (typeof value !== "number") {
            throw new Error(
              `Metadata field '${fieldName}' must be a number, got ${typeof value}`
            );
          }
          break;
        case SchemaFieldTypes.TAG:
          if (typeof value !== "string" && !Array.isArray(value)) {
            throw new Error(
              `Metadata field '${fieldName}' must be a string or array, got ${typeof value}`
            );
          }
          break;
        case SchemaFieldTypes.TEXT:
          if (typeof value !== "string") {
            throw new Error(
              `Metadata field '${fieldName}' must be a string, got ${typeof value}`
            );
          }
          break;
        default:
          // For other field types, skip validation
          break;
      }
    }
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
    this.ttl = _dbConfig.ttl;
    this.customSchema = _dbConfig.customSchema;
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
    const lastKeyCount =
      parseInt(
        info.numDocs ||
          // @ts-expect-error - num_docs is not typed as not used by all redis connectors
          info.num_docs,
        10
      ) || 0;

    // Validate all metadata against custom schema first
    if (this.customSchema) {
      for (let idx = 0; idx < documents.length; idx += 1) {
        const metadata =
          documents[idx] && documents[idx].metadata
            ? documents[idx].metadata
            : {};
        this.validateMetadata(metadata);
      }
    }

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

      // Prepare hash fields
      const hashFields: Record<string, string | Buffer> = {
        [this.vectorKey]: this.getFloat32Buffer(vector),
        [this.contentKey]: documents[idx].pageContent,
        [this.metadataKey]: this.escapeSpecialChars(JSON.stringify(metadata)),
      };

      // Add individual metadata fields for indexing if custom schema is defined
      if (this.customSchema) {
        for (const [fieldName, fieldConfig] of Object.entries(
          this.customSchema
        )) {
          const fieldValue = metadata[fieldName];
          if (fieldValue !== undefined && fieldValue !== null) {
            const indexedFieldName = `${this.metadataKey}.${fieldName}`;

            // Handle different field types appropriately
            if (
              fieldConfig.type === SchemaFieldTypes.TAG &&
              Array.isArray(fieldValue)
            ) {
              // For TAG arrays, join with separator (default comma)
              const separator = fieldConfig.SEPARATOR || ",";
              hashFields[indexedFieldName] = fieldValue.join(separator);
            } else {
              // For other types, store as-is
              hashFields[indexedFieldName] = fieldValue;
            }
          }
        }
      }

      multi.hSet(key, hashFields);

      if (this.ttl) {
        multi.expire(key, this.ttl);
      }

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
   * Method for performing a similarity search with custom metadata filtering.
   * Uses the custom schema fields for efficient filtering.
   * @param query The query vector.
   * @param k The number of nearest neighbors to return.
   * @param metadataFilter Object with metadata field filters using custom schema.
   * @returns A promise that resolves to an array of documents and their scores.
   */
  async similaritySearchVectorWithScoreAndMetadata(
    query: number[],
    k: number,
    metadataFilter?: Record<string, unknown>
  ): Promise<[Document, number][]> {
    const results = await this.redisClient.ft.search(
      this.indexName,
      ...this.buildCustomQuery(query, k, metadataFilter)
    );
    const result: [Document, number][] = [];

    if (results.total) {
      for (const res of results.documents) {
        if (res.value) {
          const document = res.value;
          if (document.vector_score) {
            // Reconstruct metadata from both the JSON field and individual fields
            let metadata: Record<string, unknown> = {};
            try {
              metadata = JSON.parse(
                this.unEscapeSpecialChars((document.metadata ?? "{}") as string)
              );
            } catch (e) {
              // If JSON parsing fails, construct from individual fields
              metadata = {};
            }

            // Add individual schema fields to metadata if they exist
            if (this.customSchema) {
              for (const fieldName of Object.keys(this.customSchema)) {
                const fieldKey = `${this.metadataKey}.${fieldName}`;
                if (document[fieldKey] !== undefined) {
                  metadata[fieldName] = document[fieldKey] as unknown;
                }
              }
            }

            result.push([
              new Document({
                pageContent: (document[this.contentKey] ?? "") as string,
                metadata,
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
   * @param docsOptions The document options to use.
   * @returns A promise that resolves to a new instance of RedisVectorStore.
   */
  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: RedisVectorStoreConfig,
    docsOptions?: RedisAddOptions
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
    return RedisVectorStore.fromDocuments(
      docs,
      embeddings,
      dbConfig,
      docsOptions
    );
  }

  /**
   * Static method for creating a new instance of RedisVectorStore from
   * documents. It adds the documents to the RedisVectorStore.
   * @param docs The documents to add.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the RedisVectorStore.
   * @param docsOptions The document options to use.
   * @returns A promise that resolves to a new instance of RedisVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: RedisVectorStoreConfig,
    docsOptions?: RedisAddOptions
  ): Promise<RedisVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs, docsOptions);
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
          "Failed to run FT.INFO command. Please ensure that you are running a RediSearch-capable Redis instance: https://js.langchain.com/docs/integrations/vectorstores/redis/#setup"
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

    // Add custom metadata schema fields for better filtering and searching
    if (this.customSchema) {
      for (const [fieldName, fieldConfig] of Object.entries(
        this.customSchema
      )) {
        // Create field name with metadata prefix (e.g., metadata.userId)
        const indexedFieldName = `${this.metadataKey}.${fieldName}`;

        // Convert CustomSchemaField to proper Redis schema field
        if (fieldConfig.type === SchemaFieldTypes.TAG) {
          schema[indexedFieldName] = {
            type: SchemaFieldTypes.TAG,
            SORTABLE: fieldConfig.SORTABLE ? true : undefined,
            SEPARATOR: (fieldConfig.SEPARATOR as string) || ",",
          };
        } else if (fieldConfig.type === SchemaFieldTypes.NUMERIC) {
          schema[indexedFieldName] = {
            type: SchemaFieldTypes.NUMERIC,
            SORTABLE: fieldConfig.SORTABLE ? true : undefined,
          };
        } else if (fieldConfig.type === SchemaFieldTypes.TEXT) {
          schema[indexedFieldName] = {
            type: SchemaFieldTypes.TEXT,
            SORTABLE: fieldConfig.SORTABLE ? true : undefined,
          };
        } else {
          // Fallback for other types - just use the field type directly
          schema[indexedFieldName] = fieldConfig.type;
        }
      }
    }

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
   *
   * Supports two deletion modes:
   * - Delete all documents by dropping the entire index and recreating it
   * - Delete specific documents by their IDs using Redis DEL operation
   *
   * @param params - The deletion parameters. Must be one of:
   *   - `{ deleteAll: boolean }` - If true, drops the entire index and all associated documents
   *   - `{ ids: string[] }` - Array of document IDs to delete. IDs will be automatically prefixed with the configured keyPrefix
   * @returns A promise that resolves when the deletion operation is complete
   * @throws {Error} Throws an error if invalid parameters are provided (neither deleteAll nor ids specified)
   *
   * @example
   * Delete all documents:
   * ```typescript
   * await vectorStore.delete({ deleteAll: true });
   * ```
   *
   * @example
   * Delete specific documents by ID:
   * ```typescript
   * await vectorStore.delete({ ids: ['doc1', 'doc2', 'doc3'] });
   * ```
   */
  async delete(
    params: { deleteAll: boolean } | { ids: string[] }
  ): Promise<void> {
    if ("deleteAll" in params && params.deleteAll) {
      await this.dropIndex(true);
    } else if ("ids" in params && params.ids && params.ids.length > 0) {
      const keys = params.ids.map((id) => `${this.keyPrefix}${id}`);

      await this.redisClient.del(keys);
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

    // Include custom schema fields in return fields for better access
    const returnFields = [this.metadataKey, this.contentKey, vectorScoreField];
    if (this.customSchema) {
      for (const fieldName of Object.keys(this.customSchema)) {
        returnFields.push(`${this.metadataKey}.${fieldName}`);
      }
    }

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

  /**
   * Builds a query with custom metadata field filtering
   * @param query The query vector
   * @param k Number of results to return
   * @param metadataFilter Object with metadata field filters
   * @returns Query string and search options
   */
  buildCustomQuery(
    query: number[],
    k: number,
    metadataFilter?: Record<string, unknown>
  ): [string, SearchOptions] {
    const vectorScoreField = "vector_score";

    let hybridFields = "*";

    // Build filter using custom schema fields
    if (metadataFilter && this.customSchema) {
      const filterClauses: string[] = [];

      for (const [fieldName, value] of Object.entries(metadataFilter)) {
        if (this.customSchema[fieldName]) {
          const fieldConfig = this.customSchema[fieldName];
          const indexedFieldName = `${this.metadataKey}.${fieldName}`;

          if (fieldConfig.type === SchemaFieldTypes.NUMERIC) {
            // Handle numeric range queries
            if (typeof value === "object" && value !== null) {
              if ("min" in value && "max" in value) {
                filterClauses.push(
                  `@${indexedFieldName}:[${value.min} ${value.max}]`
                );
              } else if ("min" in value) {
                filterClauses.push(`@${indexedFieldName}:[${value.min} +inf]`);
              } else if ("max" in value) {
                filterClauses.push(`@${indexedFieldName}:[-inf ${value.max}]`);
              }
            } else {
              // Exact numeric match
              filterClauses.push(`@${indexedFieldName}:[${value} ${value}]`);
            }
          } else if (fieldConfig.type === SchemaFieldTypes.TAG) {
            // Handle tag filtering
            if (Array.isArray(value)) {
              const tagFilter = value.map((v) => `{${v}}`).join("|");
              filterClauses.push(`@${indexedFieldName}:(${tagFilter})`);
            } else {
              filterClauses.push(`@${indexedFieldName}:{${value}}`);
            }
          } else if (fieldConfig.type === SchemaFieldTypes.TEXT) {
            // Handle text search
            filterClauses.push(`@${indexedFieldName}:(${value})`);
          }
        }
      }

      if (filterClauses.length > 0) {
        hybridFields = filterClauses.join(" ");
      }
    }

    const baseQuery = `${hybridFields} => [KNN ${k} @${this.vectorKey} $vector AS ${vectorScoreField}]`;

    // Include custom schema fields in return fields
    const returnFields = [this.metadataKey, this.contentKey, vectorScoreField];
    if (this.customSchema) {
      for (const fieldName of Object.keys(this.customSchema)) {
        returnFields.push(`${this.metadataKey}.${fieldName}`);
      }
    }

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
    if (Array.isArray(filter)) {
      return filter.map(this.escapeSpecialChars).join("|");
    }
    return filter;
  }

  /**
   * Escapes all '-', ':', and '"' characters.
   * RediSearch considers these all as special characters, so we need
   * to escape them
   * @see https://redis.io/docs/stack/search/reference/query_syntax
   *
   * @param str
   * @returns
   */
  private escapeSpecialChars(str: string) {
    return str
      .replaceAll("-", "\\-")
      .replaceAll(":", "\\:")
      .replaceAll(`"`, `\\"`);
  }

  /**
   * Unescapes all '-', ':', and '"' characters, returning the original string
   *
   * @param str
   * @returns
   */
  private unEscapeSpecialChars(str: string) {
    return str
      .replaceAll("\\-", "-")
      .replaceAll("\\:", ":")
      .replaceAll(`\\"`, `"`);
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
