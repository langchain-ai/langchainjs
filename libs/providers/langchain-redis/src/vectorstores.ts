import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import type {
  createClient,
  createCluster,
  RediSearchSchema,
  SearchOptions,
} from "redis";
import { v4 as uuidv4 } from "uuid";
import { SchemaFieldTypes, VectorAlgorithms } from "redis";
import {
  FilterExpression,
  AndFilter,
  OrFilter,
  TagFilter,
  NumericFilter,
  TextFilter,
  GeoFilter,
  TimestampFilter,
  Custom,
  CustomFilter,
  Tag,
  Num,
  Text,
  Geo,
  Timestamp,
} from "./filters.js";
import type {
  CreateSchemaVectorField,
  CreateSchemaFlatVectorField,
  CreateSchemaHNSWVectorField,
  CreateIndexOptions,
  RedisSearchLanguages,
  RedisVectorStoreIndexOptions,
  MetadataFieldSchema,
  CustomSchemaField,
} from "./schema.js";
import {
  buildMetadataSchema,
  serializeMetadataField,
  deserializeMetadataField,
  inferMetadataSchema,
  checkForSchemaMismatch,
  convertLegacySchema,
} from "./schema.js";

// Re-export filter classes and functions for backward compatibility
export {
  FilterExpression,
  AndFilter,
  OrFilter,
  TagFilter,
  NumericFilter,
  TextFilter,
  GeoFilter,
  TimestampFilter,
  Tag,
  Num,
  Text,
  Geo,
  Timestamp,
  Custom,
  CustomFilter,
};

// Re-export schema types and utilities for backward compatibility
export type {
  CreateSchemaVectorField,
  CreateSchemaFlatVectorField,
  CreateSchemaHNSWVectorField,
  CreateIndexOptions,
  RedisSearchLanguages,
  RedisVectorStoreIndexOptions,
  MetadataFieldSchema,
  CustomSchemaField,
};

export { convertLegacySchema };

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
  /**
   * Custom schema for metadata fields.
   * Supports both new array format (recommended) and legacy object format (deprecated).
   *
   * @example New format (recommended):
   * ```typescript
   * customSchema: [
   *   { name: "category", type: "tag" },
   *   { name: "price", type: "numeric", options: { sortable: true } }
   * ]
   * ```
   *
   * @example Legacy format (deprecated):
   * ```typescript
   * customSchema: {
   *   category: { type: SchemaFieldTypes.TAG },
   *   price: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true }
   * }
   * ```
   */
  customSchema?: MetadataFieldSchema[] | Record<string, CustomSchemaField>;
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
 * Type for the filter used in the RedisVectorStore. Supports multiple formats:
 * - string[]: Array of strings for simple OR filtering (legacy format)
 * - string: Raw Redis query string for custom filters (legacy format)
 * - FilterExpression: Advanced filter expressions (recommended approach)
 */
export type RedisVectorStoreFilterType = string[] | string | FilterExpression;

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

  customSchema?: MetadataFieldSchema[];

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
    this.ttl = _dbConfig.ttl;

    // Handle both legacy and new customSchema formats
    if (_dbConfig.customSchema) {
      if (Array.isArray(_dbConfig.customSchema)) {
        // New format - use as-is
        this.customSchema = _dbConfig.customSchema;
      } else {
        // Legacy format - convert to new format with deprecation warning
        this.customSchema = convertLegacySchema(_dbConfig.customSchema);
      }
    }

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
    await this.createIndex(documents, vectors[0].length);

    const multi = this.redisClient.multi();

    await Promise.all(
      vectors.map(async (vector, idx) => {
        const key =
          keys && keys.length ? keys[idx] : `${this.keyPrefix}${uuidv4()}`;

        const metadata =
          documents[idx] && documents[idx].metadata
            ? documents[idx].metadata
            : {};

        const hashFields: Record<string, string | number | Buffer> = {
          [this.vectorKey]: this.getFloat32Buffer(vector),
          [this.contentKey]: documents[idx].pageContent,
        };

        // Handle metadata based on schema configuration
        if (this.customSchema && this.customSchema.length > 0) {
          if (this.customSchema[0].name === this.metadataKey) {
            // handling legacy metadata schema for simple filters (string or array of string)
            hashFields[this.metadataKey] = JSON.stringify(metadata);
          } else {
            // Store individual metadata fields for proper indexing
            for (const fieldSchema of this.customSchema) {
              const fieldValue = metadata[fieldSchema.name];
              if (fieldValue !== undefined && fieldValue !== null) {
                hashFields[fieldSchema.name] = serializeMetadataField(
                  fieldSchema,
                  fieldValue
                );
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
      })
    );

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
            // Reconstruct metadata from individual fields if schema is configured
            let metadata: Record<string, unknown> = {};

            if (this.customSchema && this.customSchema.length > 0) {
              // Build metadata from individual schema fields
              for (const fieldSchema of this.customSchema) {
                // Skip the metadata JSON field itself - it's used for legacy filter support
                // and will be parsed separately below
                if (fieldSchema.name === this.metadataKey) {
                  continue;
                }
                const fieldValue = document[fieldSchema.name];
                if (fieldValue !== undefined && fieldValue !== null) {
                  metadata[fieldSchema.name] = deserializeMetadataField(
                    fieldSchema,
                    fieldValue
                  );
                }
              }
            }

            // Also try to parse the JSON metadata field for any additional fields
            try {
              const jsonMetadata = JSON.parse(
                this.unEscapeSpecialChars(
                  (document[this.metadataKey] ?? "{}") as string
                )
              );
              // Merge with schema-based metadata, giving priority to schema fields
              metadata = { ...jsonMetadata, ...metadata };
            } catch (error) {
              // If JSON parsing fails, use only schema-based metadata
              if (!this.customSchema || this.customSchema.length === 0) {
                metadata = {};
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
  async checkIndexState() {
    try {
      const result = await this.redisClient.ft.info(this.indexName);
      return result.attributes.some(
        (attr) => attr.identifier === this.metadataKey
      )
        ? "legacy"
        : "default";
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.message.includes("unknown command")) {
        throw new Error(
          "Failed to run FT.INFO command. Please ensure that you are running a RediSearch-capable Redis instance: https://js.langchain.com/docs/integrations/vectorstores/redis/#setup"
        );
      }
      // index doesn't exist
      return "none";
    }
  }

  /**
   * Method for creating an index in the RedisVectorStore. If the index
   * already exists, it does nothing.
   * @param dimensions The dimensions of the index
   * @param documents Optional documents to infer metadata schema from
   * @returns A promise that resolves when the index has been created.
   */
  async createIndex(documents?: Document[], dimensions = 1536): Promise<void> {
    // at that point we have decided on the metadata schema, which is needed even if the index already existed
    // however we only create the index in case it doesn't exist
    const indexState = await this.checkIndexState();

    // Determine if we need compatibility mode for legacy string/string[] filters
    const needsLegacyMetadataField =
      typeof this.filter === "string" ||
      Array.isArray(this.filter) ||
      indexState === "legacy";

    // at least one document needs to contain metadata so we can
    const hasMetadata = documents && documents.some((doc) => doc.metadata);

    // default schema - any customizations or additional fields will be added on top of this
    let schema: RediSearchSchema = {
      [this.vectorKey]: {
        type: SchemaFieldTypes.VECTOR,
        TYPE: "FLOAT32",
        DIM: dimensions,
        ...this.indexOptions,
      },
      [this.contentKey]: SchemaFieldTypes.TEXT,
    };

    // --- METADATA PROCESSING

    if (this.customSchema && this.customSchema.length !== 0) {
      // providing a custom metadata schema takes precedence above all other considerations
      // in this case, no matter if the documents have metadata, if the filter is a simple filter, etc. we proceed
      // with the custom schema, we do however warn the user if the schema does not match the metadata provided
      if (
        !documents ||
        checkForSchemaMismatch(
          this.customSchema,
          inferMetadataSchema(documents)
        )
      ) {
        console.warn(
          "The custom schema does not match the metadata schema inferred from the documents. " +
            "This is not necessarily an issue, but could indicate an invalid custom schema."
        );
      }
    } else if (!needsLegacyMetadataField && hasMetadata) {
      // if we don't have a custom schema, but we have documents with metadata, we can infer the schema
      // unless a legacy filter is provided, in which case we need to fall back to the legacy mode
      this.customSchema = inferMetadataSchema(documents);
    } else {
      // If we don't have a custom schema or documents with metadata (needed to infer the metadata), irrespective of
      // type of filter, we need to fall back to the legacy mode which would have only one text field for metadata
      this.customSchema = [
        {
          name: this.metadataKey,
          type: "text",
        },
      ];
    }

    schema = buildMetadataSchema(this.customSchema, schema);

    if (indexState === "none") {
      // we create an index only if it doesn't exist
      await this.redisClient.ft.create(
        this.indexName,
        schema,
        this.createIndexOptions
      );
    }
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
    } catch {
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
    if (filter) {
      hybridFields = this.prepareFilter(filter);
    }

    const baseQuery = `${hybridFields} => [KNN ${k} @${this.vectorKey} $vector AS ${vectorScoreField}]`;

    // Include custom schema fields in return fields for better access
    const returnFields = [this.contentKey, vectorScoreField];
    if (this.customSchema) {
      for (const fieldName of this.customSchema) {
        returnFields.push(`${fieldName.name}`);
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

  private prepareFilter(filter: RedisVectorStoreFilterType): string {
    if (!filter) {
      return "*";
    }

    // Legacy filter support, works with TEXT fields only
    if (Array.isArray(filter) || typeof filter === "string") {
      let metadataField = this.metadataKey;
      if (
        !this.customSchema?.some((field) => field.name === this.metadataKey)
      ) {
        // a rare case where the user has provided a simple filter, but the custom schema doesn't include the metadata
        // field, for example no filter was provided during vector store creation and the index creation logic assumed
        // we will be using inferred schema
        const firstTextField = this.customSchema?.find(
          (field) => field.type === "text"
        )?.name;
        if (firstTextField) {
          metadataField = firstTextField;
        }
      }

      if (Array.isArray(filter)) {
        const escapedFilter = filter
          .map((v) => `${this.escapeSpecialChars(v)}`)
          .join(",");
        return `(@${metadataField}: ${escapedFilter})`;
      }
      return `(@${metadataField}: ${filter})`;
    }

    // Check for FilterExpression objects (but not arrays)
    if (
      typeof filter === "object" &&
      "toString" in filter &&
      typeof filter.toString === "function"
    ) {
      // Use the filter expression's toString method
      return filter.toString();
    }

    return "*";
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
