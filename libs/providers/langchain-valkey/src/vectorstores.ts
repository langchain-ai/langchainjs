import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import {
  GlideClient,
  GlideClusterClient,
  GlideFt,
  Field,
} from "@valkey/valkey-glide";

export enum VectorAlgorithms {
  FLAT = "FLAT",
  HNSW = "HNSW",
}

/**
 * Type for creating a schema vector field. It includes the algorithm,
 * distance metric, and initial capacity.
 */
export type CreateSchemaVectorField<
  T extends VectorAlgorithms,
  A extends Record<string, unknown>,
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

/**
 * Enum for schema field types
 */
export enum SchemaFieldTypes {
  NUMERIC = "NUMERIC",
  TAG = "TAG",
  VECTOR = "VECTOR",
}

/**
 * Interface for custom schema field definitions
 */
export interface CustomSchemaField {
  type: SchemaFieldTypes;
  required?: boolean;
  SORTABLE?: boolean | "UNF"; // Accepted for compatibility, has no effect
  SEPARATOR?: string; // For TAG fields, default is ','
  CASESENSITIVE?: true; // For TAG fields, default is false
}

/**
 * Interface for the configuration of the ValkeyVectorStore. It includes
 * the Valkey client, index name, index options, key prefix, content key,
 * metadata key, vector key, filter and ttl.
 */
export interface ValkeyVectorStoreConfig {
  valkeyClient: GlideClient | GlideClusterClient;
  indexName: string;
  indexOptions?: CreateSchemaFlatVectorField | CreateSchemaHNSWVectorField;
  createIndexOptions?: Record<string, unknown>;
  keyPrefix?: string;
  contentKey?: string;
  metadataKey?: string;
  vectorKey?: string;
  filter?: ValkeyVectorStoreFilterType;
  ttl?: number; // ttl in second
  customSchema?: Record<string, CustomSchemaField>; // Custom schema fields for metadata
}

/**
 * Interface for the options when adding documents to the
 * ValkeyVectorStore. It includes keys and batch size.
 */
export interface ValkeyAddOptions {
  keys?: string[];
  batchSize?: number;
}

/**
 * Type for the filter used in the ValkeyVectorStore. It is an array of
 * strings.
 * If a string is passed instead of an array the value is used directly, this
 * allows custom filters to be passed.
 */
export type ValkeyVectorStoreFilterType = string[] | string;

/**
 * Class representing a ValkeyVectorStore. It extends the VectorStore class
 * and includes methods for adding documents and vectors, performing
 * similarity searches, managing the index, and more.
 */
export class ValkeyVectorStore extends VectorStore {
  declare FilterType: ValkeyVectorStoreFilterType;

  private valkeyClient: GlideClient | GlideClusterClient;

  indexName: string;

  indexOptions: CreateSchemaFlatVectorField | CreateSchemaHNSWVectorField;

  createIndexOptions: Record<string, unknown>;

  keyPrefix: string;

  contentKey: string;

  metadataKey: string;

  vectorKey: string;

  filter?: ValkeyVectorStoreFilterType;

  ttl?: number;

  customSchema?: Record<string, CustomSchemaField>;

  _vectorstoreType(): string {
    return "valkey";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    _dbConfig: ValkeyVectorStoreConfig
  ) {
    super(embeddings, _dbConfig);

    this.valkeyClient = _dbConfig.valkeyClient;
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
      ...(_dbConfig.createIndexOptions || {}),
    };
  }

  /**
   * Method for checking if an index exists in the ValkeyVectorStore.
   * @returns A promise that resolves to a boolean indicating whether the index exists.
   */
  async checkIndexExists() {
    try {
      await GlideFt.info(this.valkeyClient, this.indexName);
      return true;
    } catch (err) {
      if ((err as Error)?.message.includes("unknown command")) {
        throw new Error(
          "Failed to run FT.INFO command. Please ensure that you are running a Valkey server"
        );
      }
      // index doesn't exist
      return false;
    }
  }

  /**
   * Method for creating an index in the ValkeyVectorStore. If the index
   * already exists, it does nothing.
   * @param dimensions The dimensions of the index
   * @returns A promise that resolves when the index has been created.
   */
  async createIndex(dimensions = 1536): Promise<void> {
    if (await this.checkIndexExists()) {
      return;
    }

    const schema: Field[] = [
      // Vector field
      {
        type: "VECTOR",
        name: this.vectorKey,
        attributes: {
          algorithm: this.indexOptions.ALGORITHM,
          type: "FLOAT32",
          dimensions: dimensions,
          distanceMetric: this.indexOptions.DISTANCE_METRIC,
        },
      },
    ];

    // Add custom metadata schema fields
    if (this.customSchema) {
      for (const [fieldName, fieldConfig] of Object.entries(
        this.customSchema
      )) {
        const indexedFieldName = `${this.metadataKey}.${fieldName}`;

        // Convert CustomSchemaField to proper Field format
        if (fieldConfig.type === SchemaFieldTypes.TAG) {
          schema.push({
            type: "TAG",
            name: indexedFieldName,
          });
        } else if (fieldConfig.type === SchemaFieldTypes.NUMERIC) {
          schema.push({
            type: "NUMERIC",
            name: indexedFieldName,
          });
        } else {
          // Fallback for other types - basic field without attributes
          schema.push({
            type: fieldConfig.type as "TAG" | "NUMERIC" | "VECTOR",
            name: indexedFieldName,
          });
        }
      }
    }

    await GlideFt.create(this.valkeyClient, this.indexName, schema, {
      dataType: "HASH",
      prefixes: [this.keyPrefix],
    });
  }

  /**
   * Method for getting index information from the ValkeyVectorStore.
   * @returns A promise that resolves to the index information.
   */
  async getInfo() {
    return await GlideFt.info(this.valkeyClient, this.indexName);
  }

  /**
   * Method for dropping an index from the ValkeyVectorStore.
   * @returns A promise that resolves to a boolean indicating whether the index was dropped.
   */
  async dropIndex(): Promise<boolean> {
    try {
      await GlideFt.dropindex(this.valkeyClient, this.indexName);
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
   * - Delete specific documents by their IDs using Valkey DEL operation
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
      await this.dropIndex();
    } else if ("ids" in params && params.ids && params.ids.length > 0) {
      const keys = params.ids.map((id) =>
        id.startsWith(this.keyPrefix) ? id : `${this.keyPrefix}${id}`
      );
      await this.valkeyClient.del(keys);
    } else {
      throw new Error(`Invalid parameters passed to "delete".`);
    }
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
        default:
          // For other field types, skip validation
          break;
      }
    }
  }

  /**
   * Method for adding documents to the ValkeyVectorStore. It first converts
   * the documents to texts and then adds them as vectors.
   * @param documents The documents to add.
   * @param options Optional parameters for adding the documents.
   * @returns A promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[], options?: ValkeyAddOptions) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method for adding vectors to the ValkeyVectorStore. It checks if the
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
    { keys, batchSize = 1000 }: ValkeyAddOptions = {}
  ) {
    if (!vectors.length || !vectors[0].length) {
      throw new Error("No vectors provided");
    }
    // check if the index exists and create it if it doesn't
    await this.createIndex(vectors[0].length);

    const info = await GlideFt.info(this.valkeyClient, this.indexName);
    const lastKeyCount =
      parseInt(
        String(
          (info as Record<string, unknown>).numDocs || info.num_docs || "0"
        ),
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

    const commands: Array<{
      key: string;
      fields: Record<string, string | Buffer>;
    }> = [];

    for (let idx = 0; idx < vectors.length; idx += 1) {
      const vector = vectors[idx];
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
        [this.contentKey]: documents[idx]?.pageContent || "",
        [this.metadataKey]: JSON.stringify(metadata),
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
            if (fieldConfig.type === "TAG" && Array.isArray(fieldValue)) {
              // For TAG arrays, join with separator (default comma)
              const separator = fieldConfig.SEPARATOR || ",";
              hashFields[indexedFieldName] = fieldValue.join(separator);
            } else if (fieldConfig.type === "NUMERIC") {
              // For NUMERIC fields, ensure it's stored as a string representation of the number
              hashFields[indexedFieldName] = String(Number(fieldValue));
            } else {
              // For other types, store as-is
              hashFields[indexedFieldName] = fieldValue;
            }
          }
        }
      }

      commands.push({ key, fields: hashFields });

      // Process batch
      if (commands.length >= batchSize || idx === vectors.length - 1) {
        for (const { key, fields } of commands) {
          await this.valkeyClient.hset(key, fields);
          if (this.ttl) {
            await this.valkeyClient.expire(key, this.ttl);
          }
        }
        commands.length = 0;
      }
    }
  }

  /**
   * Method for performing a similarity search in the ValkeyVectorStore. It
   * returns the documents and their scores.
   * @param query The query vector.
   * @param k The number of nearest neighbors to return.
   * @param filter Optional filter to apply to the search.
   * @returns A promise that resolves to an array of documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: ValkeyVectorStoreFilterType
  ): Promise<[Document, number][]> {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }

    // Check if index exists before searching
    if (!(await this.checkIndexExists())) {
      return [];
    }

    const _filter = filter ?? this.filter;
    const [queryStr, options] = this.buildQuery(query, k, _filter);

    const searchOptions = {
      params: [{ key: "vector", value: options.PARAMS.vector }],
      returnFields: options.RETURN.map((field) => ({ fieldIdentifier: field })),
    };

    const results = await GlideFt.search(
      this.valkeyClient,
      this.indexName,
      queryStr,
      searchOptions
    );
    const result: [Document, number][] = [];

    if (Array.isArray(results) && results.length > 1) {
      // Results format: [totalCount, [{ key: string, value: [{ key: string, value: string }, ...] }]]
      const documents = results[1];
      if (Array.isArray(documents)) {
        for (const doc of documents) {
          if (Array.isArray(doc?.value)) {
            const fieldsObj: Record<string, unknown> = {};
            for (const field of doc.value) {
              if (field && field.key && field.value !== undefined) {
                fieldsObj[String(field.key)] = field.value;
              }
            }

            if (fieldsObj.vector_score !== undefined) {
              result.push([
                new Document({
                  pageContent: (fieldsObj[this.contentKey] ?? "") as string,
                  metadata: JSON.parse((fieldsObj.metadata ?? "{}") as string),
                }),
                Number(fieldsObj.vector_score),
              ]);
            }
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
    const [queryStr, options] = this.buildCustomQuery(query, k, metadataFilter);

    const searchOptions = {
      params: [{ key: "vector", value: options.PARAMS.vector }],
      returnFields: options.RETURN.map((field) => ({ fieldIdentifier: field })),
    };

    const results = await GlideFt.search(
      this.valkeyClient,
      this.indexName,
      queryStr,
      searchOptions
    );
    const result: [Document, number][] = [];

    if (Array.isArray(results) && results.length > 1) {
      // Results format: [totalCount, [{ key: string, value: [{ key: string, value: string }, ...] }]]
      const documents = results[1];
      if (Array.isArray(documents)) {
        for (const doc of documents) {
          if (doc && doc.value && Array.isArray(doc.value)) {
            const fieldsObj: Record<string, unknown> = {};
            for (const field of doc.value) {
              if (field && field.key && field.value !== undefined) {
                fieldsObj[String(field.key)] = field.value;
              }
            }

            if (fieldsObj.vector_score !== undefined) {
              // Reconstruct metadata from both the JSON field and individual fields
              let metadata: Record<string, unknown> = {};
              try {
                metadata = JSON.parse((fieldsObj.metadata ?? "{}") as string);
              } catch {
                // If JSON parsing fails, construct from individual fields
                metadata = {};
              }

              // Add individual schema fields to metadata if they exist
              if (this.customSchema) {
                for (const fieldName of Object.keys(this.customSchema)) {
                  const fieldKey = `${this.metadataKey}.${fieldName}`;
                  if (fieldsObj[fieldKey] !== undefined) {
                    const fieldConfig = this.customSchema[fieldName];
                    let fieldValue = fieldsObj[fieldKey] as unknown;
                    // Convert numeric fields back to numbers
                    if (
                      fieldConfig.type === "NUMERIC" &&
                      typeof fieldValue === "string"
                    ) {
                      fieldValue = Number(fieldValue);
                    }
                    metadata[fieldName] = fieldValue;
                  }
                }
              }

              result.push([
                new Document({
                  pageContent: (fieldsObj[this.contentKey] ?? "") as string,
                  metadata,
                }),
                Number(fieldsObj.vector_score),
              ]);
            }
          }
        }
      }
    }

    return result;
  }

  private buildQuery(
    query: number[],
    k: number,
    filter?: ValkeyVectorStoreFilterType
  ): [
    string,
    {
      PARAMS: { vector: Buffer };
      RETURN: string[];
      SORTBY: string;
      DIALECT: number;
      LIMIT: { from: number; size: number };
    },
  ] {
    const vectorScoreField = "vector_score";

    const hybridFields = "*";
    // if a filter is set, modify the hybrid query
    if (filter && filter.length) {
      // Filters should use custom schema fields, not the metadata JSON field
      // This is a legacy parameter that shouldn't be used without custom schema
      throw new Error(
        "Metadata filtering requires custom schema fields. Define indexed fields using customSchema option."
      );
    }

    const baseQuery = `${hybridFields} => [KNN ${k} @${this.vectorKey} $vector AS ${vectorScoreField}]`;

    // Include custom schema fields in return fields for better access
    const returnFields = [this.metadataKey, this.contentKey, vectorScoreField];
    if (this.customSchema) {
      for (const fieldName of Object.keys(this.customSchema)) {
        returnFields.push(`${this.metadataKey}.${fieldName}`);
      }
    }

    const options = {
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
  private buildCustomQuery(
    query: number[],
    k: number,
    metadataFilter?: Record<string, unknown>
  ): [
    string,
    {
      PARAMS: { vector: Buffer };
      RETURN: string[];
      SORTBY: string;
      DIALECT: number;
      LIMIT: { from: number; size: number };
    },
  ] {
    const vectorScoreField = "vector_score";

    let hybridFields = "*";

    // Build filter using custom schema fields
    if (metadataFilter && this.customSchema) {
      const filterClauses: string[] = [];

      for (const [fieldName, value] of Object.entries(metadataFilter)) {
        if (this.customSchema[fieldName]) {
          const fieldConfig = this.customSchema[fieldName];
          const indexedFieldName = `${this.metadataKey}.${fieldName}`;

          if (fieldConfig.type === "NUMERIC") {
            // Handle numeric range queries
            if (typeof value === "object" && value !== null) {
              if ("min" in value && "max" in value) {
                filterClauses.push(
                  `@${indexedFieldName}:[${(value as Record<string, unknown>).min} ${(value as Record<string, unknown>).max}]`
                );
              } else if ("min" in value) {
                filterClauses.push(
                  `@${indexedFieldName}:[${(value as Record<string, unknown>).min} +inf]`
                );
              } else if ("max" in value) {
                filterClauses.push(
                  `@${indexedFieldName}:[-inf ${(value as Record<string, unknown>).max}]`
                );
              }
            } else {
              // Exact numeric match
              filterClauses.push(`@${indexedFieldName}:[${value} ${value}]`);
            }
          } else if (fieldConfig.type === "TAG") {
            // Handle tag filtering
            if (Array.isArray(value)) {
              const tagFilter = value.map((v) => `{${v}}`).join("|");
              filterClauses.push(`@${indexedFieldName}:(${tagFilter})`);
            } else {
              filterClauses.push(`@${indexedFieldName}:{${value}}`);
            }
          } else if (fieldConfig.type === "TEXT") {
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

    const options = {
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

  private prepareFilter(filter: ValkeyVectorStoreFilterType) {
    if (Array.isArray(filter)) {
      const escaped = filter.map((f) => `{${this.escapeSpecialChars(f)}}`);
      return escaped.length > 1 ? `(${escaped.join("|")})` : escaped[0];
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

  /**
   * Static method to create a ValkeyVectorStore from documents.
   * @param docs The documents to add.
   * @param embeddings The embeddings interface.
   * @param dbConfig The Valkey configuration.
   * @param docsOptions Optional parameters for adding the documents.
   * @returns A promise that resolves to a ValkeyVectorStore instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: ValkeyVectorStoreConfig,
    docsOptions?: ValkeyAddOptions
  ): Promise<ValkeyVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs, docsOptions);
    return instance;
  }

  /**
   * Static method for creating a new instance of ValkeyVectorStore from
   * texts. It creates documents from the texts and metadata, then adds them
   * to the ValkeyVectorStore.
   * @param texts The texts to add.
   * @param metadatas The metadata associated with the texts.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the ValkeyVectorStore.
   * @param docsOptions The document options to use.
   * @returns A promise that resolves to a new instance of ValkeyVectorStore.
   */
  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: ValkeyVectorStoreConfig,
    docsOptions?: ValkeyAddOptions
  ): Promise<ValkeyVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return ValkeyVectorStore.fromDocuments(
      docs,
      embeddings,
      dbConfig,
      docsOptions
    );
  }
}
