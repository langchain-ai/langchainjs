/* eslint-disable prefer-template */
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  VectorStore,
  MaxMarginalRelevanceSearchOptions,
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";

import { Client } from "cassandra-driver";
import {
  CasssandraClientFactory,
  CassandraClientArgs,
} from "../utils/cassandra.js";

export interface Column {
  type: string;
  name: string;
  partition?: boolean;
}

export interface Index {
  name: string;
  value: string;
  options?: string;
}

export interface Filter {
  name: string;
  value: unknown | [unknown, ...unknown[]];
  operator?: string;
}

export type WhereClause = Filter[] | Filter | Record<string, unknown>;

export type SupportedVectorTypes = "cosine" | "dot_product" | "euclidean";

export interface CassandraLibArgs
  extends CassandraClientArgs,
    AsyncCallerParams {
  table: string;
  keyspace: string;
  vectorType?: SupportedVectorTypes;
  dimensions: number;
  primaryKey: Column | Column[];
  metadataColumns: Column[];
  withClause?: string;
  indices?: Index[];
  batchSize?: number;
}

/**
 * Class for interacting with the Cassandra database. It extends the
 * VectorStore class and provides methods for adding vectors and
 * documents, searching for similar vectors, and creating instances from
 * texts or documents.
 */
export class CassandraStore extends VectorStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare FilterType: WhereClause;

  private client: Client;

  private readonly vectorType: SupportedVectorTypes;

  private readonly dimensions: number;

  private readonly keyspace: string;

  private primaryKey: Column[];

  private metadataColumns: Column[];

  private withClause: string;

  private selectColumns: string;

  private readonly table: string;

  private indices: Index[];

  private initializationPromise: Promise<void> | null = null;

  asyncCaller: AsyncCaller;

  private readonly batchSize: number;

  private readonly embeddingColumnAlias = "embedding";

  private constructorArgs: CassandraLibArgs;

  _vectorstoreType(): string {
    return "cassandra";
  }

  constructor(embeddings: EmbeddingsInterface, args: CassandraLibArgs) {
    super(embeddings, args);

    const {
      indices = [],
      maxConcurrency = 25,
      withClause = "",
      batchSize = 1,
      vectorType = "cosine",
      dimensions,
      keyspace,
      table,
      primaryKey,
      metadataColumns,
    } = args;

    this.constructorArgs = {
      ...args,
      indices,
      maxConcurrency,
      withClause,
      batchSize,
      vectorType,
    };

    this.asyncCaller = new AsyncCaller(this.constructorArgs);

    // Assign properties
    this.vectorType = vectorType;
    this.dimensions = dimensions;
    this.keyspace = keyspace;
    this.table = table;
    this.primaryKey = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
    this.metadataColumns = metadataColumns;
    this.withClause = withClause.trim().replace(/^with\s*/i, "");
    this.indices = indices;
    this.batchSize = batchSize >= 1 ? batchSize : 1;

    // Start initialization but don't wait for it to complete here
    this.initialize().catch((error) => {
      console.error("Error during CassandraStore initialization:", error);
    });
  }

  /**
   * Method to save vectors to the Cassandra database.
   * @param vectors Vectors to save.
   * @param documents The documents associated with the vectors.
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }
    await this.insertAll(vectors, documents);
  }

  /**
   * Method to add documents to the Cassandra database.
   * @param documents The documents to add.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents
    );
  }

  /**
   * Helper method to search for vectors that are similar to a given query vector.
   * @param query The query vector.
   * @param k The number of similar Documents to return.
   * @param filter Optional filter to be applied as a WHERE clause.
   * @param includeEmbedding Whether to include the embedding vectors in the results.
   * @returns Promise that resolves with an array of tuples, each containing a Document and a score.
   */
  async search(
    query: number[],
    k: number,
    filter?: WhereClause,
    includeEmbedding?: boolean
  ): Promise<[Document, number][]> {
    await this.initialize();

    // Ensure we have an array of Filter from the public interface
    const filters = this.asFilters(filter);

    const queryStr = this.buildSearchQuery(filters, includeEmbedding);

    // Search query will be of format:
    //   SELECT ..., text, similarity_x(?) AS similarity_score
    //     FROM ...
    //   <WHERE ...>
    //    ORDER BY vector ANN OF ?
    //    LIMIT ?
    // If any filter values are specified, they will be in the WHERE clause as
    //   filter.name filter.operator ?
    // queryParams is a list of bind variables sent with the prepared statement
    const queryParams = [];
    const vectorAsFloat32Array = new Float32Array(query);
    queryParams.push(vectorAsFloat32Array);
    if (filters) {
      filters.forEach(({ value }) => {
        if (Array.isArray(value)) {
          queryParams.push(...value);
        } else {
          queryParams.push(value);
        }
      });
    }
    queryParams.push(vectorAsFloat32Array);
    queryParams.push(k);

    const queryResultSet = await this.client.execute(queryStr, queryParams, {
      prepare: true,
    });

    return queryResultSet?.rows.map((row) => {
      const textContent = row.text;
      const sanitizedRow = { ...row };
      delete sanitizedRow.text;
      delete sanitizedRow.similarity_score;

      if (includeEmbedding && sanitizedRow[this.embeddingColumnAlias]) {
        sanitizedRow[this.embeddingColumnAlias] = Object.values(
          sanitizedRow[this.embeddingColumnAlias]
        );
      }

      Object.keys(sanitizedRow).forEach((key) => {
        if (sanitizedRow[key] === null) {
          delete sanitizedRow[key];
        }
      });

      return [
        new Document({ pageContent: textContent, metadata: sanitizedRow }),
        row.similarity_score,
      ];
    });
  }

  /**
   * Method to search for vectors that are similar to a given query vector.
   * @param query The query vector.
   * @param k The number of similar Documents to return.
   * @param filter Optional filter to be applied as a WHERE clause.
   * @returns Promise that resolves with an array of tuples, each containing a Document and a score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: WhereClause
  ): Promise<[Document, number][]> {
    return this.search(query, k, filter, false);
  }

  /**
   * Method to search for vectors that are similar to a given query vector, but with
   * the results selected using the maximal marginal relevance.
   * @param query The query string.
   * @param options.k The number of similar Documents to return.
   * @param options.fetchK=4*k The number of records to fetch before passing to the MMR algorithm.
   * @param options.lambda=0.5 The degree of diversity among the results between 0 (maximum diversity) and 1 (minimum diversity).
   * @param options.filter Optional filter to be applied as a WHERE clause.
   * @returns List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const { k, fetchK = 4 * k, lambda = 0.5, filter } = options;

    const queryEmbedding = await this.embeddings.embedQuery(query);

    const queryResults = await this.search(
      queryEmbedding,
      fetchK,
      filter,
      true
    );

    const embeddingList = queryResults.map(
      (doc) => doc[0].metadata[this.embeddingColumnAlias]
    );

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      lambda,
      k
    );

    return mmrIndexes.map((idx) => {
      const doc = queryResults[idx][0];
      delete doc.metadata[this.embeddingColumnAlias];
      return doc;
    });
  }

  /**
   * Static method to create an instance of CassandraStore from texts.
   * @param texts The texts to use.
   * @param metadatas The metadata associated with the texts.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the CassandraStore.
   * @returns Promise that resolves with a new instance of CassandraStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: EmbeddingsInterface,
    args: CassandraLibArgs
  ): Promise<CassandraStore> {
    const docs: Document[] = [];

    for (let index = 0; index < texts.length; index += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[index] : metadatas;
      const doc = new Document({
        pageContent: texts[index],
        metadata,
      });
      docs.push(doc);
    }

    return CassandraStore.fromDocuments(docs, embeddings, args);
  }

  /**
   * Static method to create an instance of CassandraStore from documents.
   * @param docs The documents to use.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the CassandraStore.
   * @returns Promise that resolves with a new instance of CassandraStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    args: CassandraLibArgs
  ): Promise<CassandraStore> {
    const instance = new this(embeddings, args);
    await instance.initialize();

    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method to create an instance of CassandraStore from an existing
   * index.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the CassandraStore.
   * @returns Promise that resolves with a new instance of CassandraStore.
   */
  static async fromExistingIndex(
    embeddings: EmbeddingsInterface,
    args: CassandraLibArgs
  ): Promise<CassandraStore> {
    const instance = new this(embeddings, args);

    await instance.initialize();
    return instance;
  }

  /**
   * Method to initialize the Cassandra database.
   * @returns Promise that resolves when the database has been initialized.
   */
  private async initialize(): Promise<void> {
    // If already initialized or initialization is in progress, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start the initialization process and store the promise
    this.initializationPromise = this.performInitialization()
      .then(() => {
        // Initialization successful
      })
      .catch((error) => {
        // Reset to allow retrying in case of failure
        this.initializationPromise = null;
        throw error;
      });

    return this.initializationPromise;
  }

  /**
   * Method to perform the initialization tasks
   */
  private async performInitialization() {
    this.client = await CasssandraClientFactory.getClient(this.constructorArgs);

    let cql = "";
    cql = `CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.table} (
      ${this.primaryKey.map((col) => `${col.name} ${col.type}`).join(", ")}
      , text TEXT
      ${
        this.metadataColumns.length > 0
          ? ", " +
            this.metadataColumns
              .map((col) => `${col.name} ${col.type}`)
              .join(", ")
          : ""
      }
      , vector VECTOR<FLOAT, ${this.dimensions}>
      , ${this.buildPrimaryKey(this.primaryKey)}
    ) ${this.withClause ? `WITH ${this.withClause}` : ""};`;

    await this.client.execute(cql);

    this.selectColumns = `${this.primaryKey
      .map((col) => `${col.name}`)
      .join(", ")}
                          ${
                            this.metadataColumns.length > 0
                              ? ", " +
                                this.metadataColumns
                                  .map((col) => `${col.name}`)
                                  .join(", ")
                              : ""
                          }`;

    cql = `CREATE CUSTOM INDEX IF NOT EXISTS idx_vector_${this.table}
           ON ${this.keyspace}.${
      this.table
    }(vector) USING 'StorageAttachedIndex' WITH OPTIONS = {'similarity_function': '${this.vectorType.toLowerCase()}'};`;
    await this.client.execute(cql);

    const formatOptions = (options: string | undefined): string => {
      if (!options) {
        return "";
      }

      let formattedOptions = options.trim();
      if (!formattedOptions.toLowerCase().startsWith("with options =")) {
        formattedOptions = "WITH OPTIONS = " + formattedOptions;
      }

      return formattedOptions;
    };

    for await (const { name, value, options } of this.indices) {
      const optionsClause = formatOptions(options);
      cql = `CREATE CUSTOM INDEX IF NOT EXISTS idx_${this.table}_${name}
             ON ${this.keyspace}.${this.table} ${value} USING 'StorageAttachedIndex' ${optionsClause};`;
      await this.client.execute(cql);
    }
  }

  /**
   * Method to build the PRIMARY KEY clause for CREATE TABLE.
   * @param columns: list of Column to include in the key
   * @returns The clause, including PRIMARY KEY
   */
  private buildPrimaryKey(columns: Column[]): string {
    // Partition columns may be specified with optional attribute col.partition
    const partitionColumns = columns
      .filter((col) => col.partition)
      .map((col) => col.name)
      .join(", ");

    // All columns not part of the partition key are clustering columns
    const clusteringColumns = columns
      .filter((col) => !col.partition)
      .map((col) => col.name)
      .join(", ");

    let primaryKey = "";

    // If partition columns are specified, they are included in a () wrapper
    // If not, the clustering columns are used, and the first clustering column
    // is the partition key per normal Cassandra behaviour.
    if (partitionColumns) {
      primaryKey = `PRIMARY KEY ((${partitionColumns}), ${clusteringColumns})`;
    } else {
      primaryKey = `PRIMARY KEY (${clusteringColumns})`;
    }

    return primaryKey;
  }

  /**
   * Type guard to check if an object is a Filter.
   * @param obj: the object to check
   * @returns boolean indicating if the object is a Filter
   */
  private isFilter(obj: unknown): obj is Filter {
    return (
      typeof obj === "object" && obj !== null && "name" in obj && "value" in obj
    );
  }

  /**
   * Helper to convert Record<string,unknown> to a Filter[]
   * @param record: a key-value Record collection
   * @returns Record as a Filter[]
   */
  private convertToFilters(record: Record<string, unknown>): Filter[] {
    return Object.entries(record).map(([name, value]) => ({
      name,
      value,
      operator: "=",
    }));
  }

  /**
   * Input santisation method for filters, as FilterType is not required to be
   * Filter[], but we want to use Filter[] internally.
   * @param record: the proposed filter
   * @returns A Filter[], which may be empty
   */
  private asFilters(record: WhereClause | undefined): Filter[] {
    if (!record) {
      return [];
    }

    // If record is already an array
    if (Array.isArray(record)) {
      return record.flatMap((item) => {
        // Check if item is a Filter before passing it to convertToFilters
        if (this.isFilter(item)) {
          return [item];
        } else {
          // Here item is treated as Record<string, unknown>
          return this.convertToFilters(item);
        }
      });
    }

    // If record is a single Filter object, return it in an array
    if (this.isFilter(record)) {
      return [record];
    }

    // If record is a Record<string, unknown>, convert it to an array of Filter
    return this.convertToFilters(record);
  }

  /**
   * Method to build the WHERE clause of a CQL query, using bind variable ?
   * @param filters list of filters to include in the WHERE clause
   * @returns The WHERE clause
   */
  private buildWhereClause(filters?: Filter[]): string {
    if (!filters || filters.length === 0) {
      return "";
    }

    const whereConditions = filters.map(({ name, operator = "=", value }) => {
      // If value is not an array or an array with only one element, use a single '?'
      if (!Array.isArray(value) || value.length === 1) {
        return `${name} ${operator} ?`;
      }

      // From this point, value is an array with multiple elements

      // Count '?' placeholders in 'name', excluding those inside quotes
      const quotesPattern = /'[^']*'|"[^"]*"/g; // Pattern to match quoted strings (both single and double quotes)
      const modifiedName = name.replace(quotesPattern, ""); // Remove quoted strings from 'name'
      const nameQuestionMarkCount = (modifiedName.match(/\?/g) || []).length; // Count '?' in the modified string

      // Check if there are enough elements in the array for the right side of the operator
      if (value.length - nameQuestionMarkCount < 1) {
        throw new Error(
          "Insufficient bind variables for the filter condition."
        );
      }

      // Generate the placeholders for the right side of the operator
      const rightPlaceholders = new Array(value.length - nameQuestionMarkCount)
        .fill("?")
        .join(", ");

      return `${name} ${operator} ${rightPlaceholders}`;
    });

    return `WHERE ${whereConditions.join(" AND ")}`;
  }

  /**
   * Method to build an CQL query for searching for similar vectors in the
   * Cassandra database.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filters Optional filters to be applied as a WHERE clause.
   * @param includeEmbedding Whether to include the embedding vectors in the results.
   * @returns The CQL query string.
   */
  private buildSearchQuery(
    filters: Filter[],
    includeEmbedding = false
  ): string {
    const whereClause = filters ? this.buildWhereClause(filters) : "";
    const embeddingColumn = includeEmbedding
      ? `, vector AS ${this.embeddingColumnAlias}`
      : "";

    const cqlQuery = `SELECT ${this.selectColumns}, text, similarity_${this.vectorType}(vector, ?) AS similarity_score ${embeddingColumn}
                        FROM ${this.keyspace}.${this.table} ${whereClause} ORDER BY vector ANN OF ? LIMIT ?`;

    return cqlQuery;
  }

  /**
   * Method for inserting vectors and documents into the Cassandra database in a batch.
   * @param batchVectors The list of vectors to insert.
   * @param batchDocuments The list of documents to insert.
   * @returns Promise that resolves when the batch has been inserted.
   */
  private async executeInsert(
    batchVectors: number[][],
    batchDocuments: Document[]
  ): Promise<void> {
    await this.initialize();

    // Input validation: Check if the lengths of batchVectors and batchDocuments are the same
    if (batchVectors.length !== batchDocuments.length) {
      throw new Error(
        `The lengths of vectors (${batchVectors.length}) and documents (${batchDocuments.length}) must be the same.`
      );
    }

    // Initialize an array to hold query objects
    const queries = [];

    // Loop through each vector and document in the batch
    for (let i = 0; i < batchVectors.length; i += 1) {
      // Convert the list of numbers to a Float32Array, the driver's expected format of a vector
      const preparedVector = new Float32Array(batchVectors[i]);
      // Retrieve the corresponding document
      const document = batchDocuments[i];

      // Extract metadata column names and values from the document
      const metadataColNames = Object.keys(document.metadata);
      const metadataVals = Object.values(document.metadata);

      // Prepare the metadata columns string for the query, if metadata exists
      const metadataInsert =
        metadataColNames.length > 0 ? ", " + metadataColNames.join(", ") : "";

      // Construct the query string and parameters
      const query = {
        query: `INSERT INTO ${this.keyspace}.${
          this.table
        } (vector, text${metadataInsert})
                VALUES (?, ?${", ?".repeat(metadataColNames.length)})`,
        params: [preparedVector, document.pageContent, ...metadataVals],
      };

      // Add the query to the list
      queries.push(query);
    }

    // Execute the queries: use a batch if multiple, otherwise execute a single query
    if (queries.length === 1) {
      await this.client.execute(queries[0].query, queries[0].params, {
        prepare: true,
      });
    } else {
      await this.client.batch(queries, { prepare: true, logged: false });
    }
  }

  /**
   * Method for inserting vectors and documents into the Cassandra database in
   * parallel, keeping within maxConcurrency number of active insert statements.
   * @param vectors The vectors to insert.
   * @param documents The documents to insert.
   * @returns Promise that resolves when the documents have been added.
   */
  private async insertAll(
    vectors: number[][],
    documents: Document[]
  ): Promise<void> {
    // Input validation: Check if the lengths of vectors and documents are the same
    if (vectors.length !== documents.length) {
      throw new Error(
        `The lengths of vectors (${vectors.length}) and documents (${documents.length}) must be the same.`
      );
    }

    // Early exit: If there are no vectors or documents to insert, return immediately
    if (vectors.length === 0) {
      return;
    }

    // Ensure the store is initialized before proceeding
    await this.initialize();

    // Initialize an array to hold promises for each batch insert
    const insertPromises: Promise<void>[] = [];

    // Buffers to hold the current batch of vectors and documents
    let currentBatchVectors: number[][] = [];
    let currentBatchDocuments: Document[] = [];

    // Loop through each vector/document pair to insert; we use
    // <= vectors.length to ensure the last batch is inserted
    for (let i = 0; i <= vectors.length; i += 1) {
      // Check if we're still within the array boundaries
      if (i < vectors.length) {
        // Add the current vector and document to the batch
        currentBatchVectors.push(vectors[i]);
        currentBatchDocuments.push(documents[i]);
      }

      // Check if we've reached the batch size or end of the array
      if (
        currentBatchVectors.length >= this.batchSize ||
        i === vectors.length
      ) {
        // Only proceed if there are items in the current batch
        if (currentBatchVectors.length > 0) {
          // Create copies of the current batch arrays to use in the async insert operation
          const batchVectors = [...currentBatchVectors];
          const batchDocuments = [...currentBatchDocuments];

          // Execute the insert using the AsyncCaller - it will handle concurrency and queueing.
          insertPromises.push(
            this.asyncCaller.call(() =>
              this.executeInsert(batchVectors, batchDocuments)
            )
          );

          // Clear the current buffers for the next iteration
          currentBatchVectors = [];
          currentBatchDocuments = [];
        }
      }
    }

    // Wait for all insert operations to complete.
    await Promise.all(insertPromises);
  }
}
