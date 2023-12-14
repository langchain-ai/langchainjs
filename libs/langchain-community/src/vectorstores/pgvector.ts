import pg, { type Pool, type PoolClient, type PoolConfig } from "pg";
import { VectorStore } from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

type Metadata = Record<string, unknown>;

/**
 * Interface that defines the arguments required to create a
 * `PGVectorStore` instance. It includes Postgres connection options,
 * table name, filter, and verbosity level.
 */
export interface PGVectorStoreArgs {
  postgresConnectionOptions: PoolConfig;
  tableName: string;
  collectionTableName?: string;
  collectionName?: string;
  collectionMetadata?: Metadata | null;
  columns?: {
    idColumnName?: string;
    vectorColumnName?: string;
    contentColumnName?: string;
    metadataColumnName?: string;
  };
  filter?: Metadata;
  verbose?: boolean;
  /**
   * The amount of documents to chunk by when
   * adding vectors.
   * @default 500
   */
  chunkSize?: number;
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

  collectionTableName?: string;

  collectionName = "langchain";

  collectionMetadata: Metadata | null;

  idColumnName: string;

  vectorColumnName: string;

  contentColumnName: string;

  metadataColumnName: string;

  filter?: Metadata;

  _verbose?: boolean;

  pool: Pool;

  client?: PoolClient;

  chunkSize = 500;

  _vectorstoreType(): string {
    return "pgvector";
  }

  private constructor(embeddings: Embeddings, config: PGVectorStoreArgs) {
    super(embeddings, config);
    this.tableName = config.tableName;
    this.collectionTableName = config.collectionTableName;
    this.collectionName = config.collectionName ?? "langchain";
    this.collectionMetadata = config.collectionMetadata ?? null;
    this.filter = config.filter;

    this.vectorColumnName = config.columns?.vectorColumnName ?? "embedding";
    this.contentColumnName = config.columns?.contentColumnName ?? "text";
    this.idColumnName = config.columns?.idColumnName ?? "id";
    this.metadataColumnName = config.columns?.metadataColumnName ?? "metadata";

    const pool = new pg.Pool(config.postgresConnectionOptions);
    this.pool = pool;
    this.chunkSize = config.chunkSize ?? 500;

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
    if (postgresqlVectorStore.collectionTableName) {
      await postgresqlVectorStore.ensureCollectionTableInDatabase();
    }

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
   * Inserts a row for the collectionName provided at initialization if it does not
   * exist and returns the collectionId.
   *
   * @returns The collectionId for the given collectionName.
   */
  async getOrCreateCollection(): Promise<string> {
    const queryString = `
      SELECT uuid from ${this.collectionTableName}
      WHERE name = $1;
    `;
    const queryResult = await this.pool.query(queryString, [
      this.collectionName,
    ]);
    let collectionId = queryResult.rows[0]?.uuid;

    if (!collectionId) {
      const insertString = `
        INSERT INTO ${this.collectionTableName}(
          uuid,
          name,
          cmetadata
        )
        VALUES (
          uuid_generate_v4(),
          $1,
          $2
        )
        RETURNING uuid;
      `;
      const insertResult = await this.pool.query(insertString, [
        this.collectionName,
        this.collectionMetadata,
      ]);
      collectionId = insertResult.rows[0]?.uuid;
    }

    return collectionId;
  }

  /**
   * Generates the SQL placeholders for a specific row at the provided index.
   *
   * @param index - The index of the row for which placeholders need to be generated.
   * @param numOfColumns - The number of columns we are inserting data into.
   * @returns The SQL placeholders for the row values.
   */
  private generatePlaceholderForRowAt(
    index: number,
    numOfColumns: number
  ): string {
    const placeholders = [];
    for (let i = 0; i < numOfColumns; i += 1) {
      placeholders.push(`$${index * numOfColumns + i + 1}`);
    }
    return `(${placeholders.join(", ")})`;
  }

  /**
   * Constructs the SQL query for inserting rows into the specified table.
   *
   * @param rows - The rows of data to be inserted, consisting of values and records.
   * @param chunkIndex - The starting index for generating query placeholders based on chunk positioning.
   * @returns The complete SQL INSERT INTO query string.
   */
  private async buildInsertQuery(rows: (string | Record<string, unknown>)[][]) {
    let collectionId;
    if (this.collectionTableName) {
      collectionId = await this.getOrCreateCollection();
    }

    const columns = [
      this.contentColumnName,
      this.vectorColumnName,
      this.metadataColumnName,
    ];

    if (collectionId) {
      columns.push("collection_id");
    }

    const valuesPlaceholders = rows
      .map((_, j) => this.generatePlaceholderForRowAt(j, columns.length))
      .join(", ");

    const text = `
      INSERT INTO ${this.tableName}(
        ${columns}
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
    const rows = [];
    let collectionId;
    if (this.collectionTableName) {
      collectionId = await this.getOrCreateCollection();
    }

    for (let i = 0; i < vectors.length; i += 1) {
      const values = [];
      const embedding = vectors[i];
      const embeddingString = `[${embedding.join(",")}]`;
      values.push(
        documents[i].pageContent.replace(/\0/g, ""),
        embeddingString.replace(/\0/g, ""),
        documents[i].metadata
      );
      if (collectionId) {
        values.push(collectionId);
      }
      rows.push(values);
    }

    for (let i = 0; i < rows.length; i += this.chunkSize) {
      const chunk = rows.slice(i, i + this.chunkSize);
      const insertQuery = await this.buildInsertQuery(chunk);
      const flatValues = chunk.flat();
      try {
        await this.pool.query(insertQuery, flatValues);
      } catch (e) {
        console.error(e);
        throw new Error(`Error inserting: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Method to delete documents from the vector store. It deletes the
   * documents that match the provided ids.
   *
   * @param ids - Array of document ids.
   * @returns Promise that resolves when the documents have been deleted.
   */
  private async deleteById(ids: string[]) {
    let collectionId;
    if (this.collectionTableName) {
      collectionId = await this.getOrCreateCollection();
    }

    // Set parameters of dynamically generated query
    const params = collectionId ? [ids, collectionId] : [ids];

    const queryString = `
      DELETE FROM ${this.tableName}
      WHERE ${collectionId ? "collection_id = $2 AND " : ""}${
      this.idColumnName
    } = ANY($1::uuid[])
    `;
    await this.pool.query(queryString, params);
  }

  /**
   * Method to delete documents from the vector store. It deletes the
   * documents whose metadata contains the filter.
   *
   * @param filter - An object representing the Metadata filter.
   * @returns Promise that resolves when the documents have been deleted.
   */
  private async deleteByFilter(filter: Metadata) {
    let collectionId;
    if (this.collectionTableName) {
      collectionId = await this.getOrCreateCollection();
    }

    // Set parameters of dynamically generated query
    const params = collectionId ? [filter, collectionId] : [filter];

    const queryString = `
      DELETE FROM ${this.tableName}
      WHERE ${collectionId ? "collection_id = $2 AND " : ""}${
      this.metadataColumnName
    }::jsonb @> $1
    `;
    return await this.pool.query(queryString, params);
  }

  /**
   * Method to delete documents from the vector store. It deletes the
   * documents that match the provided ids or metadata filter. Matches ids
   * exactly and metadata filter according to postgres jsonb containment. Ids and filter
   * are mutually exclusive.
   *
   * @param params - Object containing either an array of ids or a metadata filter object.
   * @returns Promise that resolves when the documents have been deleted.
   * @throws Error if neither ids nor filter are provided, or if both are provided.
   * @example <caption>Delete by ids</caption>
   * await vectorStore.delete({ ids: ["id1", "id2"] });
   * @example <caption>Delete by filter</caption>
   * await vectorStore.delete({ filter: { a: 1, b: 2 } });
   */
  async delete(params: { ids?: string[]; filter?: Metadata }): Promise<void> {
    const { ids, filter } = params;

    if (!(ids || filter)) {
      throw new Error(
        "You must specify either ids or a filter when deleting documents."
      );
    }

    if (ids && filter) {
      throw new Error(
        "You cannot specify both ids and a filter when deleting documents."
      );
    }

    if (ids) {
      await this.deleteById(ids);
    } else if (filter) {
      await this.deleteByFilter(filter);
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
    let collectionId;
    if (this.collectionTableName) {
      collectionId = await this.getOrCreateCollection();
    }

    const parameters = [embeddingString, _filter, k];
    if (collectionId) {
      parameters.push(collectionId);
    }

    const queryString = `
      SELECT *, ${this.vectorColumnName} <=> $1 as "_distance"
      FROM ${this.tableName}
      WHERE ${this.metadataColumnName}::jsonb @> $2
      ${collectionId ? "AND collection_id = $4" : ""}
      ORDER BY "_distance" ASC
      LIMIT $3;
    `;

    const documents = (await this.pool.query(queryString, parameters)).rows;

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
   * Method to ensure the existence of the collection table in the database.
   * It creates the table if it does not already exist.
   *
   * @returns Promise that resolves when the collection table has been ensured.
   */
  async ensureCollectionTableInDatabase(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.collectionTableName} (
          uuid uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
          name character varying,
          cmetadata jsonb
        );

        ALTER TABLE ${this.tableName}
          ADD COLUMN collection_id uuid;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT ${this.tableName}_collection_id_fkey
          FOREIGN KEY (collection_id)
          REFERENCES ${this.collectionTableName}(uuid)
          ON DELETE CASCADE;
      `);
    } catch (e) {
      if (!(e as Error).message.includes("already exists")) {
        console.error(e);
        throw new Error(`Error adding column: ${(e as Error).message}`);
      }
    }
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
    this.client?.release();
    return this.pool.end();
  }
}
