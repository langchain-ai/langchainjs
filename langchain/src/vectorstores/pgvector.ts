import pg, { type Pool, type PoolClient, type PoolConfig } from "pg";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { getEnvironmentVariable } from "../util/env.js";

type Metadata = Record<string, unknown>;

/**
 * Interface that defines the arguments required to create a
 * `PGVectorStore` instance. It includes Postgres connection options,
 * table name, filter, and verbosity level.
 */
export interface PGVectorStoreArgs {
  postgresConnectionOptions: PoolConfig;
  tableName: string;
  columns?: {
    idColumnName?: string;
    vectorColumnName?: string;
    contentColumnName?: string;
    metadataColumnName?: string;
  };
  filter?: Metadata;
  verbose?: boolean;
}

/**
 * Class that provides an interface to a Postgres vector database. It
 * extends the `VectorStore` base class and implements methods for adding
 * documents and vectors, performing similarity searches, and ensuring the
 * existence of a table in the database.
 */
export class PGVectorStore extends VectorStore {
  declare FilterType: Metadata;

  tableName: string;

  idColumnName: string;

  vectorColumnName: string;

  contentColumnName: string;

  metadataColumnName: string;

  filter?: Metadata;

  _verbose?: boolean;

  pool: Pool;

  client?: PoolClient;

  _vectorstoreType(): string {
    return "pgvector";
  }

  private constructor(embeddings: Embeddings, config: PGVectorStoreArgs) {
    super(embeddings, config);
    this.tableName = config.tableName;
    this.filter = config.filter;

    this.vectorColumnName = config.columns?.vectorColumnName ?? "embedding";
    this.contentColumnName = config.columns?.contentColumnName ?? "text";
    this.idColumnName = config.columns?.idColumnName ?? "id";
    this.metadataColumnName = config.columns?.metadataColumnName ?? "metadata";

    const pool = new pg.Pool(config.postgresConnectionOptions);
    this.pool = pool;

    this._verbose =
      getEnvironmentVariable("LANGCHAIN_VERBOSE") === "true" ??
      !!config.verbose;
  }

  /**
   * Static method to create a new `PGVectorStore` instance from a
   * connection. It creates a table if one does not exist, and calls
   * `connect` to return a new instance of `PGVectorStore`.
   *
   * @param embeddings - Embeddings instance.
   * @param fields - `PGVectorStoreArgs` instance.
   * @returns A new instance of `PGVectorStore`.
   */
  static async initialize(
    embeddings: Embeddings,
    config: PGVectorStoreArgs
  ): Promise<PGVectorStore> {
    const postgresqlVectorStore = new PGVectorStore(embeddings, config);

    await postgresqlVectorStore._initializeClient();
    await postgresqlVectorStore.ensureTableInDatabase();

    return postgresqlVectorStore;
  }

  protected async _initializeClient() {
    this.client = await this.pool.connect();
  }

  /**
   * Method to add documents to the vector store. It converts the documents into
   * vectors, and adds them to the store.
   *
   * @param documents - Array of `Document` instances.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);

    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Generates the SQL placeholders for a specific row at the provided index.
   *
   * @param index - The index of the row for which placeholders need to be generated.
   * @returns The SQL placeholders for the row values.
   */
  private generatePlaceholderForRowAt(index: number): string {
    const base = index * 3;
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  }

  /**
   * Constructs the SQL query for inserting rows into the specified table.
   *
   * @param rows - The rows of data to be inserted, consisting of values and records.
   * @param chunkIndex - The starting index for generating query placeholders based on chunk positioning.
   * @returns The complete SQL INSERT INTO query string.
   */
  private buildInsertQuery(
    rows: (string | Record<string, unknown>)[][],
    chunkIndex: number
  ) {
    const valuesPlaceholders = rows
      .map((_, j) => this.generatePlaceholderForRowAt(chunkIndex + j))
      .join(", ");

    const text = `
      INSERT INTO ${this.tableName}(
        ${this.contentColumnName},
        ${this.vectorColumnName},
        ${this.metadataColumnName}
      )
      VALUES ${valuesPlaceholders}
    `;
    return text;
  }

  /**
   * Method to add vectors to the vector store. It converts the vectors into
   * rows and inserts them into the database.
   *
   * @param vectors - Array of vectors.
   * @param documents - Array of `Document` instances.
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      return [
        documents[idx].pageContent,
        embeddingString,
        documents[idx].metadata,
      ];
    });

    const chunkSize = 500;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const insertQuery = this.buildInsertQuery(chunk, i);
      const flatValues = chunk.flat();

      try {
        await this.pool.query(insertQuery, flatValues);
      } catch (e) {
        console.error(e);
        throw new Error(`Error inserting: ${chunk[1]}`);
      }
    }
  }

  /**
   * Method to perform a similarity search in the vector store. It returns
   * the `k` most similar documents to the query vector, along with their
   * similarity scores.
   *
   * @param query - Query vector.
   * @param k - Number of most similar documents to return.
   * @param filter - Optional filter to apply to the search.
   * @returns Promise that resolves with an array of tuples, each containing a `Document` and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    const embeddingString = `[${query.join(",")}]`;
    const _filter = filter ?? "{}";

    const queryString = `
      SELECT *, ${this.vectorColumnName} <=> $1 as "_distance"
      FROM ${this.tableName}
      WHERE ${this.metadataColumnName} @> $2
      ORDER BY "_distance" ASC
      LIMIT $3;`;

    const documents = (
      await this.pool.query(queryString, [embeddingString, _filter, k])
    ).rows;

    const results = [] as [Document, number][];
    for (const doc of documents) {
      if (doc._distance != null && doc[this.contentColumnName] != null) {
        const document = new Document({
          pageContent: doc[this.contentColumnName],
          metadata: doc[this.metadataColumnName],
        });
        results.push([document, doc._distance]);
      }
    }
    return results;
  }

  /**
   * Method to ensure the existence of the table in the database. It creates
   * the table if it does not already exist.
   *
   * @returns Promise that resolves when the table has been ensured.
   */
  async ensureTableInDatabase(): Promise<void> {
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        "${this.idColumnName}" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "${this.contentColumnName}" text,
        "${this.metadataColumnName}" jsonb,
        "${this.vectorColumnName}" vector
      );
    `);
  }

  /**
   * Static method to create a new `PGVectorStore` instance from an
   * array of texts and their metadata. It converts the texts into
   * `Document` instances and adds them to the store.
   *
   * @param texts - Array of texts.
   * @param metadatas - Array of metadata objects or a single metadata object.
   * @param embeddings - Embeddings instance.
   * @param dbConfig - `PGVectorStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `PGVectorStore`.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: PGVectorStoreArgs
  ): Promise<PGVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }

    return PGVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a new `PGVectorStore` instance from an
   * array of `Document` instances. It adds the documents to the store.
   *
   * @param docs - Array of `Document` instances.
   * @param embeddings - Embeddings instance.
   * @param dbConfig - `PGVectorStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `PGVectorStore`.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: PGVectorStoreArgs
  ): Promise<PGVectorStore> {
    const instance = await PGVectorStore.initialize(embeddings, dbConfig);
    await instance.addDocuments(docs);

    return instance;
  }

  /**
   * Closes all the clients in the pool and terminates the pool.
   *
   * @returns Promise that resolves when all clients are closed and the pool is terminated.
   */
  async end(): Promise<void> {
    await this.client?.release();
    return this.pool.end();
  }
}
