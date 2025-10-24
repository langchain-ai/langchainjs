import { VectorStore } from "@langchain/core/vectorstores";
import {
  useQuery,
  useExecute,
  getDatabases,
  createDatabase,
  getTables,
  type AzionDatabaseResponse,
  QueryResult,
  getDatabase,
} from "azion/sql";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";

/**
 * Represents a filter condition for querying the Azion database
 * @property operator - The comparison operator to use (e.g. =, !=, >, <, etc)
 * @property column - The database column to filter on
 * @property value - The value to compare against
 */
export type AzionFilter = { operator: Operator; column: Column; value: string };

/**
 * Represents a database column name
 */
export type Column = string;

/**
 * Valid SQL operators that can be used in filter conditions
 */
export type Operator =
  | "="
  | "!="
  | ">"
  | "<>"
  | "<" // Basic comparison operators
  | ">="
  | "<=" // Range operators
  | "LIKE"
  | "NOT LIKE" // Pattern matching
  | "IN"
  | "NOT IN" // Set membership
  | "IS NULL"
  | "IS NOT NULL"; // NULL checks

/**
 * Interface for configuring the Azion vector store setup
 * @property {string[]} columns - Additional columns to create in the database table. If expandedMetadata is true, this is required.
 * @property {"vector" | "hybrid"} mode - The search mode to enable:
 *                                       "vector" - Only vector similarity search
 *                                       "hybrid" - Both vector and full-text search capabilities
 */
interface AzionSetupOptions {
  columns?: string[];
  mode: "vector" | "hybrid";
}

/**
 * Interface representing the structure of a row in the vector store
 * @property content - The text content of the document
 * @property embedding - The vector embedding of the content as an array of numbers
 * @property metadata - Additional metadata associated with the document as key-value pairs
 */
interface RowsInterface {
  content: string;
  embedding: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Interface for the response returned when searching embeddings.
 */
interface SearchEmbeddingsResponse {
  id: number;
  content: string;
  similarity: number;
  metadata: {
    searchtype: string;
    [key: string]: unknown;
  };
}

/**
 * Interface for configuring hybrid search options that combines vector and full-text search
 * @property {number} kfts - Number of results to return from full-text search
 * @property {number} kvector - Number of results to return from vector similarity search
 * @property {AzionFilter[]} [filter] - Optional array of filters to apply to search results
 * @property {string[]} [metadataItems] - Optional array of metadata fields to include in results
 */
interface HybridSearchOptions {
  kfts: number;
  kvector: number;
  filter?: AzionFilter[];
  metadataItems?: string[];
}

/**
 * Interface for configuring full-text search options
 * @property {number} kfts - Number of results to return from full-text search
 * @property {AzionFilter[]} [filter] - Optional array of filters to apply to search results
 * @property {string[]} [metadataItems] - Optional array of metadata fields to include in results
 */
interface FullTextSearchOptions {
  kfts: number;
  filter?: AzionFilter[];
  metadataItems?: string[];
}

/**
 * Interface for configuring vector similarity search options
 * @property {number} kvector - Number of results to return from vector similarity search
 * @property {AzionFilter[]} [filter] - Optional array of filters to apply to search results
 * @property {string[]} [metadataItems] - Optional array of metadata fields to include in results
 */
interface SimilaritySearchOptions {
  kvector: number;
  filter?: AzionFilter[];
  metadataItems?: string[];
}

/**
 * Interface for the arguments required to initialize an Azion library.
 */
export interface AzionVectorStoreArgs {
  tableName: string;
  filter?: AzionFilter[];
  dbName: string;
  expandedMetadata?: boolean;
}

/**
 * Example usage:
 * ```ts
 * // Initialize the vector store
 * const vectorStore = new AzionVectorStore(embeddings, {
 *   dbName: "mydb",
 *   tableName: "documents"
 * });
 *
 * // Setup database with hybrid search and metadata columns
 * await vectorStore.setupDatabase({
 *   columns: ["topic", "language"],
 *   mode: "hybrid"
 * });
 *
 *
 * // OR: Initialize using the static create method
 * const vectorStore = await AzionVectorStore.initialize(embeddings, {
 *   dbName: "mydb",
 *   tableName: "documents"
 * }, {
 *   columns: ["topic", "language"],
 *   mode: "hybrid"
 * });
 *
 * By default, the columns are not expanded, meaning that the metadata is stored in a single column:
 *
 * // Setup database with hybrid search and metadata columns
 * await vectorStore.setupDatabase({
 *   columns: ["*"],
 *   mode: "hybrid"
 * });
 *
 * // Add documents to the vector store
 * await vectorStore.addDocuments([
 *   new Document({
 *     pageContent: "Australia is known for its unique wildlife",
 *     metadata: { topic: "nature", language: "en" }
 *   })
 * ]);
 *
 * // Perform similarity search
 * const results = await vectorStore.similaritySearch(
 *   "coral reefs in Australia",
 *   2, // Return top 2 results
 *   { filter: [{ operator: "=", column: "topic", string: "biology" }] } // Optional AzionFilter
 * );
 *
 * // Perform full text search
 * const ftResults = await vectorStore.fullTextSearch(
 *   "Sydney Opera House",
 *   1, // Return top result
 *   { filter: [{ operator: "=", column: "language", string: "en" }] } // Optional AzionFilter
 * );
 * ```
 */

export class AzionVectorStore extends VectorStore {
  /** Type declaration for filter type */
  declare FilterType: AzionFilter[];

  /** Name of the main table to store vectors and documents */
  tableName: string;

  /** Name of the database to use */
  dbName: string;

  /** Whether the metadata is contained in a single column or multiple columns */
  expandedMetadata: boolean;

  _vectorstoreType(): string {
    return "azionEdgeSQL";
  }

  constructor(embeddings: EmbeddingsInterface, args: AzionVectorStoreArgs) {
    super(embeddings, args);
    this.tableName = args.tableName;
    this.dbName = args.dbName;
    this.expandedMetadata = args.expandedMetadata ?? false;
  }

  /**
   * Creates a new vector store instance and sets up the database.
   * @param {EmbeddingsInterface} embeddings - The embeddings interface to use for vectorizing documents
   * @param {AzionVectorStoreArgs} args - Configuration options:
   *   @param {string} args.dbName - Name of the database to create/use
   *   @param {string} args.tableName - Name of the table to create/use
   * @param {AzionSetupOptions} setupOptions - Database setup options:
   *   @param {string[]} setupOptions.columns - Additional columns to create in the table beyond the required ones. If expandedMetadata is true, this is required.
   *   @param {"vector"|"hybrid"} setupOptions.mode - The search mode to enable:
   *     - "vector": Only vector similarity search capabilities
   *     - "hybrid": Both vector and full-text search capabilities
   * @returns {Promise<AzionVectorStore>} A promise that resolves with the configured vector store instance
   */
  static async initialize(
    embeddings: EmbeddingsInterface,
    args: AzionVectorStoreArgs,
    setupOptions: AzionSetupOptions
  ): Promise<AzionVectorStore> {
    const instance = new AzionVectorStore(embeddings, args);
    await instance.setupDatabase(setupOptions);
    return instance;
  }

  /**
   * Adds documents to the vector store.
   * @param {Document[]} documents The documents to add.
   * @param {Object} options Optional parameters for adding the documents.
   * @returns A promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]) {
    const texts = documents.map((doc) => doc.pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);
    return this.addVectors(embeddings, documents);
  }

  /**
   * Adds vectors to the vector store.
   * @param {number[][]} vectors The vectors to add.
   * @param {Document[]} documents The documents associated with the vectors.
   * @param {Object} options Optional parameters for adding the vectors.
   * @returns A promise that resolves with the IDs of the added vectors when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]) {
    const rows = await this.mapRowsFromDocuments(vectors, documents);
    const insertStatements = this.createStatements(rows);
    const chunks = this.createInsertChunks(insertStatements);

    await this.insertChunks(chunks);
  }

  /**
   * Gets the dimensions of the embeddings.
   * @returns {Promise<number>} The dimensions of the embeddings.
   */
  private async getEmbeddingsDimensions(): Promise<number> {
    return (await this.embeddings.embedQuery("test")).length;
  }

  /**
   * Maps the rows and metadata to the correct format.
   * @param vectors The vectors to map.
   * @param {Document[]} documents The documents to map.
   * @returns {Promise<RowsInterface[]>} The mapped rows and metadata.
   */
  private async mapRowsFromDocuments(
    vectors: number[][],
    documents: Document[]
  ): Promise<RowsInterface[]> {
    return vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));
  }

  /**
   * Sets up the database and tables.
   * @param {AzionSetupOptions} setupOptions The setup options:
   *   - columns: string[] - The metadata columns to add to the table
   *   - mode: "vector" | "hybrid" - The mode to use for the table. "vector" for vector search only, "hybrid" for vector and full-text search
   * @returns {Promise<void>} A promise that resolves when the database and tables have been set up.
   */
  async setupDatabase(setupOptions: AzionSetupOptions): Promise<void> {
    const { columns, mode } = setupOptions;

    if (this.expandedMetadata && !columns) {
      throw new Error("Columns must be informed when using expanded metadata!");
    }

    await this.handleDatabase();

    await this.handleTables(mode, columns);
  }

  /**
   * Handles the table creation and setup.
   * @param {string} mode The mode.
   * @param {string[]} columns The columns to setup.
   * @returns {Promise<void>} A promise that resolves when the table has been created and setup.
   */
  private async handleTables(
    mode: "vector" | "hybrid",
    columns: string[] | undefined
  ): Promise<void> {
    const { data: dataTables, error: errorTables } = await getTables(
      this.dbName
    );

    this.errorHandler(errorTables, "Error getting tables");

    const tables = dataTables?.results?.[0]?.rows?.map((row) => row[1]);

    if (!this.areTablesSetup(tables, mode)) {
      const { error: errorSetupDb } = await this.setupTables(mode, columns);
      this.errorHandler(errorSetupDb, "Error setting up tables");
    }
  }

  /**
   * Handles the error.
   * @param {Object} error The error object.
   * @param {string} message The message to display.
   * @returns {void} A void value.
   */
  private errorHandler(
    error:
      | {
          message: string;
          operation: string;
        }
      | undefined,
    message: string
  ): void {
    if (error) {
      console.log(message, error);
      throw new Error(error?.message ?? message);
    }
  }

  /**
   * Checks if the tables are setup.
   * @param {string | number | string[] | number[]} tables The tables.
   * @param {string} mode The mode.
   * @returns {boolean} Whether the tables are setup.
   */
  private areTablesSetup(
    tables: (string | number)[] | undefined,
    mode: "vector" | "hybrid"
  ): boolean {
    if (!tables) {
      return false;
    }

    if (mode === "hybrid") {
      return (
        tables?.includes(this.tableName) &&
        tables?.includes(this.tableName + "_fts")
      );
    }

    return tables?.includes(this.tableName);
  }

  /**
   * Handles the database creation and setup.
   * @returns {Promise<void>} A promise that resolves when the database has been created and setup.
   */
  private async handleDatabase(): Promise<void> {
    const { data: dataGet, error: errorGet } = await getDatabases();

    this.errorHandler(errorGet, "Error getting databases");

    if (!dataGet?.databases?.find((db) => db.name === this.dbName)) {
      console.log("Creating database: ", this.dbName);
      const { error: errorCreate } = await createDatabase(this.dbName);

      await this.waitDatabaseCreation(this.dbName);

      console.log(`Database ${this.dbName} created`);

      this.errorHandler(errorCreate, "Error creating database");
    }
  }

  /**
   * Wait for the database to be created. Retry every 3 seconds until the database is created.
   * @param databaseName {string} The database name
   * @returns {Promise<void>}
   */
  private async waitDatabaseCreation(databaseName: string): Promise<string> {
    let databaseStatus = "creating";
    while (databaseStatus !== "created") {
      const { data, error } = await getDatabase(databaseName);

      if (error) {
        throw error;
      }

      if (data && data.status === "created") {
        databaseStatus = "created";
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 3000);
      });
    }
    return "Created";
  }

  /**
   * Sets up the tables based on the specified mode and columns.
   * @param {string} mode The mode to use - either "vector" for vector search only or "hybrid" for vector + full text search
   * @param {string[]} columns Additional metadata columns to add to the tables
   * @returns {Promise<AzionDatabaseResponse<string>>} A promise that resolves when the tables have been created and setup
   */
  private async setupTables(
    mode: "vector" | "hybrid",
    columns: string[] | undefined
  ): Promise<AzionDatabaseResponse<string>> {
    let createTableColumns = ",metadata JSON";

    if (this.expandedMetadata && columns) {
      createTableColumns =
        columns.length > 0
          ? "," + columns.map((key) => `${key} TEXT`).join(",")
          : "";
    }

    const createTableStatement = `
        CREATE TABLE ${this.tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            embedding F32_BLOB(${await this.getEmbeddingsDimensions()})
            ${createTableColumns}
        );`;

    const createIndexStatement = `
        CREATE INDEX ${this.tableName}_idx ON ${this.tableName} (
            libsql_vector_idx(embedding, 'metric=cosine', 'compress_neighbors=float8', 'max_neighbors=20')
        )`;

    let createFtsColumns = ",metadata";
    if (this.expandedMetadata && columns) {
      createFtsColumns =
        columns.length > 0
          ? "," + columns.map((key) => `${key}`).join(",")
          : "";
    }

    const createFtsStatement = `
        CREATE VIRTUAL TABLE IF NOT EXISTS ${this.tableName}_fts USING fts5(
            content,
            id UNINDEXED
            ${createFtsColumns},
            tokenize = 'porter'
        )`;

    let createTriggersColumns = ",metadata";
    let insertTriggersValues = ",new.metadata";
    let updateTriggersColumns = ",metadata = new.metadata";

    if (this.expandedMetadata && columns) {
      createTriggersColumns = columns.length > 0 ? "," + columns.join(",") : "";
      insertTriggersValues =
        columns.length > 0
          ? "," + columns.map((key) => `new.${key}`).join(",")
          : "";
      updateTriggersColumns =
        columns.length > 0
          ? "," + columns.map((key) => `${key} = new.${key}`).join(",")
          : "";
    }

    const createTriggersStatements = [
      `CREATE TRIGGER IF NOT EXISTS insert_into_${this.tableName}_fts 
        AFTER INSERT ON ${this.tableName}
        BEGIN
            INSERT INTO ${this.tableName}_fts(id, content ${createTriggersColumns})
            VALUES(new.id, new.content ${insertTriggersValues});
        END`,

      `CREATE TRIGGER IF NOT EXISTS update_${this.tableName}_fts 
        AFTER UPDATE ON ${this.tableName}
        BEGIN
            UPDATE ${this.tableName}_fts 
            SET content = new.content
            ${updateTriggersColumns}
            WHERE id = old.id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS delete_${this.tableName}_fts
        AFTER DELETE ON ${this.tableName}
        BEGIN
            DELETE FROM ${this.tableName}_fts WHERE id = old.id;
        END`,
    ];

    let allStatements = [
      createTableStatement,
      createIndexStatement,
      createFtsStatement,
      ...createTriggersStatements,
    ];

    if (mode === "vector") {
      allStatements = allStatements.slice(0, 2);
    }

    const { error } = await useExecute(this.dbName, allStatements);
    this.errorHandler(error, "Error setting up tables");
    return { data: "Database setup successfully", error: undefined };
  }

  /**
   * Inserts the chunks into the database.
   * @param {string[][]} chunks The chunks to insert.
   * @returns {Promise<void>} A promise that resolves when the chunks have been inserted.
   */
  private async insertChunks(chunks: string[][]): Promise<void> {
    for (const chunk of chunks) {
      console.log("Inserting chunk", chunks.indexOf(chunk));
      const { error } = await useExecute(this.dbName, chunk, { debug: true });
      this.errorHandler(error, "Error inserting chunk");
    }
    console.log("Chunks inserted!");
  }

  /**
   * Extracts the metadata columns from the rows.
   * @param {RowsInterface[]} rows The rows to extract the metadata columns from.
   * @returns {string[]} The metadata columns.
   */
  private extractMetadataColumns(rows: RowsInterface[]): string[] {
    const metadataColumns: string[] = [];

    for (const row of Object.values(rows)) {
      if (row.metadata) {
        Object.keys(row.metadata).forEach((key) => {
          if (!metadataColumns.includes(key)) {
            metadataColumns.push(key);
          }
        });
      }
    }
    return metadataColumns;
  }

  /**
   * Creates the insert statement for a row.
   * @param {RowsInterface} row The row to create the insert statement for.
   * @param {string[]} metadataColumns The metadata columns.
   * @returns {string} The insert statement.
   */
  private createInsertStatement(
    row: RowsInterface,
    metadataColumns: string[]
  ): string {
    if (this.expandedMetadata) {
      const columnNames = ["content", "embedding", ...metadataColumns];
      const values = [
        row.content,
        row.embedding,
        ...metadataColumns.map((col) => row.metadata?.[col] ?? null),
      ];
      return this.createInsertString(columnNames, values);
    }

    const columnNames = ["content", "embedding", "metadata"];
    const values = [row.content, row.embedding, JSON.stringify(row.metadata)];

    return this.createInsertString(columnNames, values);
  }

  /**
   * Creates the insert statements for the rows.
   * @param {RowsInterface[]} rows The rows to create the insert statements for.
   * @returns {string[]} The insert statements.
   */
  private createStatements(rows: RowsInterface[]): string[] {
    const insertStatements = [];
    const metadataColumns = this.extractMetadataColumns(rows);

    for (const row of rows) {
      const statement = this.createInsertStatement(row, metadataColumns);
      insertStatements.push(statement);
    }

    return insertStatements;
  }

  /**
   * Creates the insert chunks for the statements.
   * @param {string[]} statements The statements to create the insert chunks for.
   * @returns {string[][]} The insert chunks.
   */
  private createInsertChunks(statements: string[]): string[][] {
    const maxChunkLength = 1000;
    const maxMbSize = 0.8 * 1024 * 1024;
    const insertChunk = [];
    let originalStatements = statements;
    const totalSize = this.getStringBytes(originalStatements.join(" "));

    if (totalSize < maxMbSize && originalStatements.length < maxChunkLength) {
      return [originalStatements];
    }

    console.log("Total size exceeded max size. Initiating chunking...");
    let array: string[] = [];
    while (originalStatements.length > 0) {
      for (const statement of originalStatements) {
        const totalStringBytes =
          this.getStringBytes(statement) + this.getStringBytes(array.join(" "));
        if (totalStringBytes > maxMbSize || array.length + 1 > maxChunkLength) {
          insertChunk.push(array);
          array = [statement];
          originalStatements = originalStatements.slice(1);
        } else {
          array.push(statement);
          if (originalStatements.length === 1) {
            insertChunk.push(array);
          }
          originalStatements = originalStatements.slice(1);
        }
      }
    }

    return insertChunk;
  }

  /**
   * Gets the number of bytes in a string.
   * @param {string} str The string to get the number of bytes for.
   * @returns {number} The number of bytes in the string.
   */
  private getStringBytes(str: string): number {
    return new TextEncoder().encode(str).length;
  }

  /**
   * Performs a similarity search on the vector store and returns the top 'similarityK' similar documents.
   * @param {number[]} vector The vector to search for.
   * @param {number} k The number of documents to return.
   * @param {AzionFilter[]} filter Optional filters to apply to the search.
   * @param {string[]} metadataItems Optional metadata items to include in the search.
   * @returns {Promise<[Document, number][]>} A promise that resolves with the similarity search results when the search is complete.
   */
  async similaritySearchVectorWithScore(
    vector: number[],
    k: number,
    filter?: AzionFilter[],
    metadataItems?: string[]
  ): Promise<[Document, number][]> {
    const metadata = this.generateMetadata(metadataItems, "similarity");

    const filters = this.generateFilters(filter);

    const similarityQuery = `
      SELECT 
      id, content, ${metadata}, 1 - vector_distance_cos(embedding, vector('[${vector}]')) as similarity
      FROM ${this.tableName}  
      WHERE ${filters} rowid IN vector_top_k('${this.tableName}_idx', vector('[${vector}]'), ${k})`;

    const { data, error } = await useQuery(this.dbName, [similarityQuery]);

    if (!data) {
      this.errorHandler(error, "Error performing similarity search");
      throw this.searchError(error);
    }

    const searches = this.mapRows(data.results);
    const results = this.mapSearches(searches);
    return results;
  }

  /**
   * Performs a full-text search on the vector store and returns the top 'k' similar documents.
   * @param query The query string to search for
   * @param options The options for the full-text search, including:
   *                - kfts: The number of full-text search results to return
   *                - filter: Optional filters to apply to narrow down the search results
   *                - metadataItems: Optional metadata fields to include in the results
   * @returns A promise that resolves with the full-text search results when the search is complete.
   */
  async azionFullTextSearch(query: string, options: FullTextSearchOptions) {
    const { kfts, filter, metadataItems } = options;
    const metadata = this.generateMetadata(metadataItems, "fulltextsearch");

    const filters = this.generateFilters(filter);

    const fullTextQuery = `
      SELECT id, content, ${metadata}, rank as bm25_similarity
      FROM ${this.tableName}_fts  
      WHERE ${filters} ${this.tableName}_fts MATCH '${this.convert2FTSQuery(
      query
    )}'
      LIMIT ${kfts}`;

    const { data, error } = await useQuery(this.dbName, [fullTextQuery]);

    if (!data) {
      this.errorHandler(error, "Error performing full-text search");
      throw this.searchError(error);
    }

    const searches = this.mapRows(data?.results);
    const results = this.mapSearches(searches);
    return results;
  }

  /**
   * Performs a hybrid search on the vector store and returns the top 'k' similar documents.
   * @param query The query string to search for
   * @param options The options for the hybrid search, including:
   *                - kfts: The number of full-text search results to return
   *                - kvector: The number of vector search results to return
   *                - filter: Optional filters to apply to narrow down the search results
   *                - metadataItems: Optional metadata fields to include in the results
   * @returns A promise that resolves with the hybrid search results when the search is complete.
   */
  async azionHybridSearch(
    query: string,
    hybridSearchOptions: HybridSearchOptions
  ): Promise<[Document, number][]> {
    const { kfts, kvector, filter, metadataItems } = hybridSearchOptions;

    const vector = await this.embeddings.embedQuery(query);
    const ftsResults = await this.azionFullTextSearch(query, {
      kfts,
      filter,
      metadataItems,
    });

    const vectorResults = await this.similaritySearchVectorWithScore(
      vector,
      kvector,
      filter,
      metadataItems
    );

    return this.removeDuplicates(
      [...ftsResults, ...vectorResults],
      kfts,
      kvector
    );
  }

  /**
   * Performs a similarity search on the vector store and returns the top 'k' similar documents.
   * @param query The query string.
   * @param options The options for the similarity search, including:
   *                - kvector: The number of vector search results to return
   *                - filter: Optional filters to apply to the search
   *                - metadataItems: Optional metadata fields to include in results
   * @returns A promise that resolves with the similarity search results when the search is complete.
   */
  async azionSimilaritySearch(
    query: string,
    options: SimilaritySearchOptions
  ): Promise<[Document, number][]> {
    const { kvector, filter, metadataItems } = options;
    const vector = await this.embeddings.embedQuery(query);
    return this.similaritySearchVectorWithScore(
      vector,
      kvector,
      filter,
      metadataItems
    );
  }

  /**
   * Generates an error document based on the provided error information
   * @param {Object} error The error object containing details about the issue
   * @returns {Promise<[Document, number][]>} A promise that resolves to an array containing a single Document representing the error
   */
  private searchError(
    error:
      | {
          message: string;
          operation: string;
        }
      | undefined
  ): Error {
    throw new Error(error?.message);
  }

  /**
   * Deletes documents from the vector store.
   * @param {string[]} ids The IDs of the documents to delete.
   * @returns {Promise<void>} A promise that resolves when the documents have been deleted.
   */
  async delete(ids: string[]): Promise<void> {
    const deleteStatement = `DELETE FROM ${
      this.tableName
    } WHERE id IN (${ids.join(",")})`;
    const { error } = await useExecute(this.dbName, [deleteStatement]);
    if (error) {
      this.errorHandler(
        error,
        `Error deleting document from ${this.tableName}`
      );
    } else {
      console.log(`Deleted ${ids.length} items from ${this.tableName}`);
    }
  }

  /**
   * Removes duplicate results from the search results, prioritizing a mix of similarity and FTS results.
   * @param {[Document, number][]} results - The array of search results to process, containing document and score pairs
   * @param {number} kfts - Maximum number of full-text search results to include
   * @param {number} kvector - Maximum number of vector similarity search results to include
   * @returns {[Document, number][]} An array of unique search results, limited by kfts and kvector parameters
   */
  private removeDuplicates(
    results: [Document, number][],
    kfts: number,
    kvector: number
  ): [Document, number][] {
    const uniqueResults: [Document, number][] = [];
    const seenIds = new Set<string | undefined>();

    let similarityCount = 0;
    let ftsCount = 0;
    const maxItems = kfts + kvector;

    for (const result of results) {
      if (!seenIds.has(result[0].id)) {
        if (
          result[0].metadata?.searchtype === "similarity" &&
          similarityCount < kvector
        ) {
          seenIds.add(result[0].id);
          uniqueResults.push(result);
          similarityCount += 1;
        } else if (
          result[0].metadata.searchtype === "fulltextsearch" &&
          ftsCount < kfts
        ) {
          seenIds.add(result[0].id);
          uniqueResults.push(result);
          ftsCount += 1;
        }
      }
      if (similarityCount + ftsCount === maxItems) break;
    }
    return uniqueResults;
  }

  /**
   * Converts query results to SearchEmbeddingsResponse objects.
   * @param {QueryResult[]} results - The raw query results from the database.
   * @returns {SearchEmbeddingsResponse[]} An array of SearchEmbeddingsResponse objects.
   */
  private mapRows(
    results: QueryResult[] | undefined
  ): SearchEmbeddingsResponse[] {
    if (!results) {
      return [];
    }

    return results.flatMap(
      (queryResult: QueryResult): SearchEmbeddingsResponse[] => {
        if (!queryResult.rows || !queryResult.columns) {
          return [];
        }

        return queryResult.rows.map(
          (row): SearchEmbeddingsResponse => ({
            id: Number(row[0]),
            content: String(row[1]),
            metadata: JSON.parse(String(row[2])),
            similarity: Number(row[3]),
          })
        );
      }
    );
  }

  /**
   * Maps search results to Document objects.
   * @param {SearchEmbeddingsResponse[]} searches An array of SearchEmbeddingsResponse objects.
   * @returns An array of tuples, each containing a single Document object.
   */
  private mapSearches(
    searches: SearchEmbeddingsResponse[]
  ): [Document, number][] {
    return searches.map((resp: SearchEmbeddingsResponse) => [
      new Document({
        metadata: resp.metadata,
        pageContent: resp.content,
        id: resp.id.toString(),
      }),
      resp.similarity,
    ]);
  }

  /**
   * Generates the metadata string for the SQL query.
   * @param {string[]} metadataItems - The metadata items to include in the query.
   * @param {string} searchType - The type of search.
   * @returns {string} The metadata string.
   */
  private generateMetadata(
    metadataItems: string[] | undefined,
    searchType: string
  ): string {
    if (!metadataItems) {
      return `json_object('searchtype', '${searchType}') as metadata`;
    }

    if (this.expandedMetadata) {
      return `json_object('searchtype','${searchType}',${metadataItems
        .map(
          (item) => `'${this.sanitizeItem(item)}', ${this.sanitizeItem(item)}`
        )
        .join(", ")}) as metadata`;
    }

    return `json_patch(json_object(${metadataItems
      ?.map(
        (item) =>
          `'${this.sanitizeItem(item)}', metadata->>'$.${this.sanitizeItem(
            item
          )}'`
      )
      .join(", ")}), '{"searchtype":"${searchType}"}') as metadata`;
  }

  /**
   * Generates the filters string for the SQL query.
   * @param {AzionFilter[]} filters The filters to apply to the query.
   * @returns {string} The filters string.
   */
  private generateFilters(filters: AzionFilter[] | undefined): string {
    if (!filters || filters?.length === 0) {
      return "";
    }

    return (
      filters
        .map(({ operator, column, value }) => {
          const columnRef = this.expandedMetadata
            ? this.sanitizeItem(column)
            : `metadata->>'$.${this.sanitizeItem(column)}'`;
          if (["IN", "NOT IN"].includes(operator.toUpperCase())) {
            return `${columnRef} ${operator} (${this.sanitizeItem(value)})`;
          }
          return `${columnRef} ${operator} '${this.sanitizeItem(value)}'`;
        })
        .join(" AND ") + " AND "
    );
  }

  /**
   * Creates the insert sql query for a row.
   * @param {string[]} columnNames The column names.
   * @param {string[]} values The values.
   * @returns {string} The insert sql query.
   */
  private createInsertString(
    columnNames: string[],
    values: (string | number[])[]
  ): string {
    if (this.expandedMetadata) {
      const string = `INSERT INTO ${this.tableName} (${columnNames.join(", ")}) 
      VALUES (${values
        .map((value, index) =>
          columnNames[index] === "embedding"
            ? `vector('[${value}]')`
            : `'${this.escapeQuotes(value)}'`
        )
        .join(", ")})`;

      return string;
    }

    const string = `INSERT INTO ${this.tableName} (${columnNames.join(", ")}) 
    VALUES (${values
      .map((value, index) => {
        if (columnNames[index] === "embedding") {
          return `vector('[${value}]')`;
        } else if (columnNames[index] === "metadata") {
          return `'${value}'`;
        } else {
          return `'${this.escapeQuotes(value)}'`;
        }
      })
      .join(", ")})`;
    return string;
  }

  /**
   * Escapes the quotes in the value.
   * @param {string} value The value to escape the quotes in.
   * @returns {string} The value with the quotes escaped.
   */
  private escapeQuotes(value: string | number[]): string | number[] {
    if (typeof value === "string") {
      return value.replace(/'/g, " ").replace(/"/g, " ");
    }
    return value;
  }

  /**
   * Sanitizes an item by removing non-alphanumeric characters.
   * @param {string} item The item to sanitize.
   * @returns {string} The sanitized item.
   */
  private sanitizeItem(item: string | undefined): string {
    if (item) {
      return item.replace(/[^a-zA-Z0-9\s]/g, "");
    }
    return "";
  }

  /**
   * Converts a query to a FTS query.
   * @param query The user query
   * @returns The converted FTS query
   */
  protected convert2FTSQuery(query: string): string {
    return query
      .replace(/[^a-záàâãéèêíïóôõöúçñA-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ0-9\s]/g, "") // Remove special chars keeping accents
      .replace(/\s+/g, " ") // Remove multiple spaces
      .trim() // Remove leading/trailing spaces
      .split(" ")
      .join(" OR ");
  }
}
