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
  CreateSchemaFlatVectorField,
  CreateSchemaHNSWVectorField,
  CreateIndexOptions,
  RedisVectorStoreIndexOptions,
  MetadataFieldSchema,
} from "./schema.js";
import {
  buildMetadataSchema,
  serializeMetadataField,
  deserializeMetadataField,
  inferMetadataSchema,
  checkForSchemaMismatch,
} from "./schema.js";
import type { RedisAddOptions } from "./vectorstores.js";

// Re-export filter classes and functions
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

// Re-export MetadataFieldSchema from schema (not exported from vectorstores.ts)
export type { MetadataFieldSchema };

/**
 * Interface for the configuration of the FluentRedisVectorStore.
 * This advanced version requires explicit metadata schema definition
 * and only supports FilterExpression for filtering.
 *
 * For basic filtering with string[] or string filters, use RedisVectorStore instead.
 */
export interface FluentRedisVectorStoreConfig {
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
  filter?: FluentRedisVectorStoreFilterType;
  ttl?: number; // ttl in second
  /**
   * Custom schema for metadata fields (required for advanced filtering).
   * Only supports the new array format with MetadataFieldSchema.
   *
   * @example
   * ```typescript
   * customSchema: [
   *   { name: "category", type: "tag" },
   *   { name: "price", type: "numeric", options: { sortable: true } },
   *   { name: "description", type: "text", options: { weight: 2.0 } },
   *   { name: "location", type: "geo" }
   * ]
   * ```
   */
  customSchema?: MetadataFieldSchema[];
}

/**
 * Type for the filter used in the FluentRedisVectorStore.
 * Only supports FilterExpression for advanced filtering.
 *
 * For legacy string[] | string filters, use the basic RedisVectorStore instead.
 */
export type FluentRedisVectorStoreFilterType = FilterExpression;

/**
 * Advanced Redis Vector Store with structured metadata filtering.
 *
 * This class provides advanced filtering capabilities through FilterExpression
 * and requires explicit MetadataFieldSchema definition. It supports:
 * - Tag filters for categorical data
 * - Numeric filters for ranges and comparisons
 * - Text filters for full-text search
 * - Geo filters for location-based queries
 * - Complex filter combinations with AND/OR logic
 *
 * For basic filtering with simple string[] or string filters, use RedisVectorStore instead.
 *
 * @example
 * ```typescript
 * const vectorStore = await FluentRedisVectorStore.fromDocuments(
 *   docs,
 *   embeddings,
 *   {
 *     redisClient: client,
 *     indexName: "products",
 *     customSchema: [
 *       { name: "category", type: "tag" },
 *       { name: "price", type: "numeric", options: { sortable: true } }
 *     ]
 *   }
 * );
 *
 * // Use advanced filtering
 * const results = await vectorStore.similaritySearch(
 *   "laptop",
 *   5,
 *   Tag("category").eq("electronics").and(Num("price").lt(1000))
 * );
 * ```
 */
export class FluentRedisVectorStore extends VectorStore {
  declare FilterType: FluentRedisVectorStoreFilterType;

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

  filter?: FilterExpression;

  ttl?: number;

  customSchema?: MetadataFieldSchema[];

  _vectorstoreType(): string {
    return "redis_fluent";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    _dbConfig: FluentRedisVectorStoreConfig
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(embeddings, _dbConfig as Record<string, any>);

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
   * Method for adding vectors to the FluentRedisVectorStore. It checks if the
   * index exists and creates it if it doesn't, then adds the vectors in batches.
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

        // Store individual metadata fields for proper indexing
        if (this.customSchema && this.customSchema.length > 0) {
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
   * Method for performing a similarity search in the FluentRedisVectorStore.
   * Returns documents and their similarity scores.
   * @param query The query vector.
   * @param k The number of nearest neighbors to return.
   * @param filter Optional FilterExpression to apply to the search.
   * @returns A promise that resolves to an array of documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: FilterExpression
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
            // Reconstruct metadata from individual schema fields
            const metadata: Record<string, unknown> = {};

            if (this.customSchema && this.customSchema.length > 0) {
              // Build metadata from individual schema fields
              for (const fieldSchema of this.customSchema) {
                const fieldValue = document[fieldSchema.name];
                if (fieldValue !== undefined && fieldValue !== null) {
                  metadata[fieldSchema.name] = deserializeMetadataField(
                    fieldSchema,
                    fieldValue
                  );
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
   * Static method for creating a new instance of FluentRedisVectorStore from
   * texts. It creates documents from the texts and metadata, then adds them
   * to the FluentRedisVectorStore.
   * @param texts The texts to add.
   * @param metadatas The metadata associated with the texts.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the FluentRedisVectorStore.
   * @param docsOptions The document options to use.
   * @returns A promise that resolves to a new instance of FluentRedisVectorStore.
   */
  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: FluentRedisVectorStoreConfig,
    docsOptions?: RedisAddOptions
  ): Promise<FluentRedisVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return FluentRedisVectorStore.fromDocuments(
      docs,
      embeddings,
      dbConfig,
      docsOptions
    );
  }

  /**
   * Static method for creating a new instance of FluentRedisVectorStore from
   * documents. It adds the documents to the FluentRedisVectorStore.
   * @param docs The documents to add.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the FluentRedisVectorStore.
   * @param docsOptions The document options to use.
   * @returns A promise that resolves to a new instance of FluentRedisVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: FluentRedisVectorStoreConfig,
    docsOptions?: RedisAddOptions
  ): Promise<FluentRedisVectorStore> {
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
          "Failed to run FT.INFO command. Please ensure that you are running a RediSearch-capable Redis instance: https://js.langchain.com/docs/integrations/vectorstores/redis/#setup",
          { cause: err }
        );
      }
      // index doesn't exist
      return "none";
    }
  }

  /**
   * Method for creating an index in the FluentRedisVectorStore.
   * Requires a customSchema to be defined for proper metadata indexing.
   * If the index already exists, it does nothing.
   *
   * @param documents Optional documents to validate against the schema
   * @param dimensions The dimensions of the vector field (default: 1536)
   * @returns A promise that resolves when the index has been created.
   * @throws Error if customSchema is not defined
   */
  async createIndex(documents?: Document[], dimensions = 1536): Promise<void> {
    if (!this.customSchema || this.customSchema.length === 0) {
      throw new Error(
        "FluentRedisVectorStore requires a customSchema to be defined. " +
          "Please provide a customSchema with MetadataFieldSchema definitions in the configuration."
      );
    }

    // Check if the index already exists
    const indexState = await this.checkIndexState();

    // Validate schema against documents if provided
    if (documents && documents.length > 0) {
      const inferredSchema = inferMetadataSchema(documents);
      if (checkForSchemaMismatch(this.customSchema, inferredSchema)) {
        console.warn(
          "The custom schema does not match the metadata schema inferred from the documents. " +
            "This is not necessarily an issue, but could indicate an invalid custom schema."
        );
      }
    }

    // Build the RediSearch schema
    let schema: RediSearchSchema = {
      [this.vectorKey]: {
        type: SchemaFieldTypes.VECTOR,
        TYPE: "FLOAT32",
        DIM: dimensions,
        ...this.indexOptions,
      },
      [this.contentKey]: SchemaFieldTypes.TEXT,
    };

    schema = buildMetadataSchema(this.customSchema, schema);

    if (indexState === "none") {
      // Create the index only if it doesn't exist
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
    filter?: FilterExpression
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

  private prepareFilter(filter?: FilterExpression): string {
    if (!filter) {
      return "*";
    }

    // Only FilterExpression is supported in the advanced version
    if (
      typeof filter === "object" &&
      "toString" in filter &&
      typeof filter.toString === "function"
    ) {
      // Use the filter expression's toString method
      return filter.toString();
    }

    // If we get here, the filter is not a valid FilterExpression
    throw new Error(
      "FluentRedisVectorStore only supports FilterExpression filters. " +
        "Use Tag(), Num(), Text(), Geo(), or Timestamp() to create filters. " +
        "For simple string[] or string filters, use the basic RedisVectorStore instead."
    );
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

/**
 * @deprecated Use {@link FluentRedisVectorStore} instead.
 * This is an alias for backward compatibility.
 */
export const RedisVectorStoreAdvanced = FluentRedisVectorStore;
