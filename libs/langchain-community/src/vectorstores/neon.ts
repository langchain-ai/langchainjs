import { neon } from "@neondatabase/serverless";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

type Metadata = Record<string, string | number | Record<"in", string[]>>;

/**
 * Interface that defines the arguments required to create a
 * `NeonPostgres` instance. It includes Postgres connection options,
 * table name, filter, and verbosity level.
 */
export interface NeonPostgresArgs {
  connectionString: string;
  tableName?: string;
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
 * Class that provides an interface to a Neon Postgres database. It
 * extends the `VectorStore` base class and implements methods for adding
 * documents and vectors, performing similarity searches, and ensuring the
 * existence of a table in the database.
 */
export class NeonPostgres extends VectorStore {
  declare FilterType: Metadata;

  tableName: string;

  idColumnName: string;

  vectorColumnName: string;

  contentColumnName: string;

  metadataColumnName: string;

  filter?: Metadata;

  _verbose?: boolean;

  neonConnectionString: string;

  _vectorstoreType(): string {
    return "neon-postgres";
  }

  constructor(embeddings: EmbeddingsInterface, config: NeonPostgresArgs) {
    super(embeddings, config);
    this._verbose =
      config.verbose ?? getEnvironmentVariable("LANGCHAIN_VERBOSE") === "true";

    this.neonConnectionString = config.connectionString;
    this.tableName = config.tableName ?? "vectorstore_documents";
    this.filter = config.filter;

    this.vectorColumnName = config.columns?.vectorColumnName ?? "embedding";
    this.contentColumnName = config.columns?.contentColumnName ?? "text";
    this.idColumnName = config.columns?.idColumnName ?? "id";
    this.metadataColumnName = config.columns?.metadataColumnName ?? "metadata";
  }

  /**
   * Static method to create a new `NeonPostgres` instance from a
   * connection. It creates a table if one does not exist.
   *
   * @param embeddings - Embeddings instance.
   * @param fields - `NeonPostgresArgs` instance.
   * @returns A new instance of `NeonPostgres`.
   */
  static async initialize(
    embeddings: EmbeddingsInterface,
    config: NeonPostgresArgs
  ): Promise<NeonPostgres> {
    const neonVectorStore = new NeonPostgres(embeddings, config);
    await neonVectorStore.ensureTableInDatabase();
    return neonVectorStore;
  }

  /**
   * Constructs the SQL query for inserting rows into the specified table.
   *
   * @param rows - The rows of data to be inserted, consisting of values and records.
   * @param chunkIndex - The starting index for generating query placeholders based on chunk positioning.
   * @returns The complete SQL INSERT INTO query string.
   */
  protected async runInsertQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: (string | Record<string, any>)[][],
    useIdColumn: boolean
  ) {
    const placeholders = rows.map((row, index) => {
      const base = index * row.length;
      return `(${row.map((_, j) => `$${base + 1 + j}`)})`;
    });
    const queryString = `
    INSERT INTO ${this.tableName} (
        ${useIdColumn ? `${this.idColumnName},` : ""}
        ${this.contentColumnName}, 
        ${this.vectorColumnName}, 
        ${this.metadataColumnName}
    ) VALUES ${placeholders.join(", ")}
    ON CONFLICT (${this.idColumnName}) 
    DO UPDATE 
    SET 
        ${this.contentColumnName} = EXCLUDED.${this.contentColumnName},
        ${this.vectorColumnName} = EXCLUDED.${this.vectorColumnName},
        ${this.metadataColumnName} = EXCLUDED.${this.metadataColumnName}
    RETURNING ${this.idColumnName}
    `;

    const flatValues = rows.flat();
    const sql = neon(this.neonConnectionString);
    return await sql(queryString, flatValues);
  }

  /**
   * Method to add vectors to the vector store. It converts the vectors into
   * rows and inserts them into the database.
   *
   * @param vectors - Array of vectors.
   * @param documents - Array of `Document` instances.
   * @param options - Optional arguments for adding documents
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    if (options?.ids !== undefined && options?.ids.length !== vectors.length) {
      throw new Error(
        `If provided, the length of "ids" must be the same as the number of vectors.`
      );
    }

    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      const row = [
        documents[idx].pageContent,
        embeddingString,
        documents[idx].metadata,
      ];
      if (options?.ids) {
        return [options.ids[idx], ...row];
      }
      return row;
    });

    const chunkSize = 500;
    const ids = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      try {
        const result = await this.runInsertQuery(
          chunk,
          options?.ids !== undefined
        );
        ids.push(...result.map((row) => row[this.idColumnName]));
      } catch (e) {
        console.error(e);
        throw new Error(`Error inserting: ${(e as Error).message}`);
      }
    }
    return ids;
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
    const _filter: this["FilterType"] = filter ?? {};

    const whereClauses = [];
    const parameters = [embeddingString, k];
    let paramCount = parameters.length;

    // The vector to query with, and the num of results are the first
    // two parameters. The rest of the parameters are the filter values
    for (const [key, value] of Object.entries(_filter)) {
      if (typeof value === "object" && value !== null) {
        const currentParamCount = paramCount;
        const placeholders = value.in
          .map((_, index) => `$${currentParamCount + index + 1}`)
          .join(",");
        whereClauses.push(
          `${this.metadataColumnName}->>'${key}' IN (${placeholders})`
        );
        parameters.push(...value.in);
        paramCount += value.in.length;
      } else {
        paramCount += 1;
        whereClauses.push(
          `${this.metadataColumnName}->>'${key}' = $${paramCount}`
        );
        parameters.push(value);
      }
    }

    const whereClause = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";
    const queryString = `
      SELECT *, ${this.vectorColumnName} <=> $1 as "_distance"
      FROM ${this.tableName}
      ${whereClause}
      ORDER BY "_distance" ASC
      LIMIT $2;`;

    const sql = neon(this.neonConnectionString);
    const documents = await sql(queryString, parameters);

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
   * Method to add documents to the vector store. It converts the documents into
   * vectors, and adds them to the store.
   *
   * @param documents - Array of `Document` instances.
   * @param options - Optional arguments for adding documents
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method to delete documents from the vector store. It deletes the
   * documents that match the provided ids.
   *
   * @param ids - Array of document ids.
   * @param deleteAll - Boolean to delete all documents.
   * @returns Promise that resolves when the documents have been deleted.
   */
  async delete(params: { ids?: string[]; deleteAll?: boolean }): Promise<void> {
    const sql = neon(this.neonConnectionString);

    if (params.ids !== undefined) {
      await sql(
        `DELETE FROM ${this.tableName} 
        WHERE ${this.idColumnName} 
        IN (${params.ids.map((_, idx) => `$${idx + 1}`)})`,
        params.ids
      );
    } else if (params.deleteAll) {
      await sql(`TRUNCATE TABLE ${this.tableName}`);
    }
  }

  /**
   * Method to ensure the existence of the table to store vectors in
   * the database. It creates the table if it does not already exist.
   *
   * @returns Promise that resolves when the table has been ensured.
   */
  async ensureTableInDatabase(): Promise<void> {
    const sql = neon(this.neonConnectionString);

    await sql(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await sql(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await sql(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        ${this.idColumnName} uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        ${this.contentColumnName} text,
        ${this.metadataColumnName} jsonb,
        ${this.vectorColumnName} vector
      );
    `);
  }

  /**
   * Static method to create a new `NeonPostgres` instance from an
   * array of texts and their metadata. It converts the texts into
   * `Document` instances and adds them to the store.
   *
   * @param texts - Array of texts.
   * @param metadatas - Array of metadata objects or a single metadata object.
   * @param embeddings - Embeddings instance.
   * @param dbConfig - `NeonPostgresArgs` instance.
   * @returns Promise that resolves with a new instance of `NeonPostgresArgs`.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: NeonPostgresArgs
  ): Promise<NeonPostgres> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return this.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a new `NeonPostgres` instance from an
   * array of `Document` instances. It adds the documents to the store.
   *
   * @param docs - Array of `Document` instances.
   * @param embeddings - Embeddings instance.
   * @param dbConfig - `NeonPostgreseArgs` instance.
   * @returns Promise that resolves with a new instance of `NeonPostgres`.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: NeonPostgresArgs
  ): Promise<NeonPostgres> {
    const instance = await this.initialize(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
