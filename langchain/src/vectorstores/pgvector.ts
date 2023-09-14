import { Metadata } from "@opensearch-project/opensearch/api/types.js";
import { Pool, PoolConfig } from "pg";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { getEnvironmentVariable } from "../util/env.js";

/**
 * Interface that defines the arguments required to create a
 * `PGVectorStore` instance. It includes Postgres connection options,
 * table name, filter, and verbosity level.
 */
export interface PGVectorStoreArgs {
  postgresConnectionOptions: PoolConfig;
  tableName?: string;
  filter?: Metadata;
  verbose?: boolean;
}

/**
 * Class that extends the `Document` base class and adds an `embedding`
 * property. It represents a document in the vector store.
 */
export class PGVectorStoreDocument extends Document {
  embedding: string;

  id?: string;
}

const defaultDocumentTableName = "documents";

/**
 * Class that provides an interface to a Postgres vector database. It
 * extends the `VectorStore` base class and implements methods for adding
 * documents and vectors, performing similarity searches, and ensuring the
 * existence of a table in the database.
 */
export class PGVectorStore extends VectorStore {
  declare FilterType: Metadata;

  tableName: string;

  filter?: Metadata;

  _verbose?: boolean;

  pool: Pool;

  _vectorstoreType(): string {
    return "typeorm";
  }

  private constructor(embeddings: Embeddings, fields: PGVectorStoreArgs) {
    super(embeddings, fields);
    this.tableName = fields.tableName || defaultDocumentTableName;
    this.filter = fields.filter;

    const pool = new Pool(fields.postgresConnectionOptions);
    this.pool = pool;

    this._verbose =
      getEnvironmentVariable("LANGCHAIN_VERBOSE") === "true" ??
      fields.verbose ??
      false;
  }

  /**
   * Static method to create a new `PGVectorStore` instance from a
   * connection. It calls `connect` on `pool` and returns
   * a new instance of `PGVectorStore`.
   * @param embeddings Embeddings instance.
   * @param fields `PGVectorStoreArgs` instance.
   * @returns A new instance of `PGVectorStore`.
   */
  static async fromDataSource(
    embeddings: Embeddings,
    fields: PGVectorStoreArgs
  ): Promise<PGVectorStore> {
    const postgresqlVectorStore = new PGVectorStore(embeddings, fields);
    await postgresqlVectorStore.pool.connect();
    return postgresqlVectorStore;
  }

  /**
   * Method to add documents to the vector store. It ensures the existence
   * of the table in the database, converts the documents into vectors, and
   * adds them to the store.
   * @param documents Array of `Document` instances.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    // This will create the table if it does not exist. We can call it every time as it doesn't
    // do anything if the table already exists, and it is not expensive in terms of performance
    await this.ensureTableInDatabase();
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Method to add vectors to the vector store. It converts the vectors into
   * rows and inserts them into the database.
   * @param vectors Array of vectors.
   * @param documents Array of `Document` instances.
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const rows = vectors.map((embedding, idx) => {
      const embeddingString = `[${embedding.join(",")}]`;
      const documentRow = {
        pageContent: documents[idx].pageContent,
        embedding: embeddingString,
        metadata: documents[idx].metadata,
      };

      return documentRow;
    });

    const chunkSize = 500;
    const insertQuery = `
      INSERT INTO your_table_name(column1, column2, ...)
      VALUES $1::text[], $2::text[], ...
    `;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
    
      try {
        await this.pool.query(insertQuery, chunk);
      } catch (e) {
        console.error(e);
        throw new Error(`Error inserting: ${chunk[0].pageContent}`);
      }
    }
  }

  /**
   * Method to perform a similarity search in the vector store. It returns
   * the `k` most similar documents to the query vector, along with their
   * similarity scores.
   * @param query Query vector.
   * @param k Number of most similar documents to return.
   * @param filter Optional filter to apply to the search.
   * @returns Promise that resolves with an array of tuples, each containing a `PGVectorStoreDocument` and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[PGVectorStoreDocument, number][]> {
    const embeddingString = `[${query.join(",")}]`;
    const _filter = filter ?? "{}";

    const queryString = `
      SELECT *, embedding <=> $1 as "_distance"
      FROM ${this.tableName}
      WHERE metadata @> $2
      ORDER BY "_distance" ASC
      LIMIT $3;`;

    const documents = (await this.pool.query<PGVectorStoreDocument & { _distance: number }>(queryString, [
      embeddingString,
      _filter,
      k,
    ])).rows;

    const results = [] as [PGVectorStoreDocument, number][];
    for (const doc of documents) {
      if (doc._distance != null && doc.pageContent != null) {
        const document = new Document(doc) as PGVectorStoreDocument;
        document.id = doc.id;
        results.push([document, doc._distance]);
      }
    }

    return results;
  }

  /**
   * Method to ensure the existence of the table in the database. It creates
   * the table if it does not already exist.
   * @returns Promise that resolves when the table has been ensured.
   */
  async ensureTableInDatabase(): Promise<void> {
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await this.pool.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "pageContent" text,
        metadata jsonb,
        embedding vector
      );
    `);
  }

  /**
   * Static method to create a new `PGVectorStore` instance from an
   * array of texts and their metadata. It converts the texts into
   * `Document` instances and adds them to the store.
   * @param texts Array of texts.
   * @param metadatas Array of metadata objects or a single metadata object.
   * @param embeddings Embeddings instance.
   * @param dbConfig `PGVectorStoreArgs` instance.
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
   * @param docs Array of `Document` instances.
   * @param embeddings Embeddings instance.
   * @param dbConfig `PGVectorStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `PGVectorStore`.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: PGVectorStoreArgs
  ): Promise<PGVectorStore> {
    const instance = await PGVectorStore.fromDataSource(embeddings, dbConfig);
    await instance.addDocuments(docs);

    return instance;
  }

  /**
   * Static method to create a new `PGVectorStore` instance from an
   * existing index.
   * @param embeddings Embeddings instance.
   * @param dbConfig `PGVectorStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `PGVectorStore`.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: PGVectorStoreArgs
  ): Promise<PGVectorStore> {
    const instance = await PGVectorStore.fromDataSource(embeddings, dbConfig);
    return instance;
  }
}
