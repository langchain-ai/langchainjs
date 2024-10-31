import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import type { Client, InStatement } from "@libsql/client";

/**
 * Interface for LibSQLVectorStore configuration options.
 */
export interface LibSQLVectorStoreArgs {
  db: Client;
  /** Name of the table to store vectors. Defaults to "vectors". */
  table?: string;
  /** Name of the column to store embeddings. Defaults to "embedding". */
  column?: string;
  // TODO: Support adding additional columns to the table for metadata.
}

/**
 * A vector store using LibSQL/Turso for storage and retrieval.
 */
export class LibSQLVectorStore extends VectorStore {
  declare FilterType: (doc: Document) => boolean;

  private db;

  private readonly table: string;

  private readonly column: string;

  /**
   * Returns the type of vector store.
   * @returns {string} The string "libsql".
   */
  _vectorstoreType(): string {
    return "libsql";
  }

  /**
   * Initializes a new instance of the LibSQLVectorStore.
   * @param {EmbeddingsInterface} embeddings - The embeddings interface to use.
   * @param {Client} db - The LibSQL client instance.
   * @param {LibSQLVectorStoreArgs} options - Configuration options for the vector store.
   */
  constructor(embeddings: EmbeddingsInterface, options: LibSQLVectorStoreArgs) {
    super(embeddings, options);

    this.db = options.db;
    this.table = options.table || "vectors";
    this.column = options.column || "embedding";
  }

  /**
   * Adds documents to the vector store.
   * @param {Document[]} documents - The documents to add.
   * @returns {Promise<string[]>} The IDs of the added documents.
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);

    return this.addVectors(embeddings, documents);
  }

  /**
   * Adds vectors to the vector store.
   * @param {number[][]} vectors - The vectors to add.
   * @param {Document[]} documents - The documents associated with the vectors.
   * @returns {Promise<string[]>} The IDs of the added vectors.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[]
  ): Promise<string[]> {
    const rows = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding: `[${embedding.join(",")}]`,
      metadata: JSON.stringify(documents[idx].metadata),
    }));

    const batchSize = 100;
    const ids: string[] = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);

      const insertQueries: InStatement[] = chunk.map((row) => ({
        sql: `INSERT INTO ${this.table} (content, metadata, ${this.column}) VALUES (:content, :metadata, vector(:embedding)) RETURNING ${this.table}.rowid AS id`,
        args: row,
      }));

      const results = await this.db.batch(insertQueries);

      ids.push(
        ...results.flatMap((result) => result.rows.map((row) => String(row.id)))
      );
    }

    return ids;
  }

  /**
   * Performs a similarity search using a vector query and returns documents with their scores.
   * @param {number[]} query - The query vector.
   * @param {number} k - The number of results to return.
   * @returns {Promise<[Document, number][]>} An array of tuples containing the similar documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number
    // filter is currently unused
    // filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    // Potential SQL injection risk if query vector is not properly sanitized.
    if (!query.every((num) => typeof num === "number" && !Number.isNaN(num))) {
      throw new Error("Invalid query vector: all elements must be numbers");
    }

    const queryVector = `[${query.join(",")}]`;

    const sql: InStatement = {
      sql: `SELECT ${this.table}.rowid as id, ${this.table}.content, ${this.table}.metadata, vector_distance_cos(${this.table}.${this.column}, vector(:queryVector)) AS distance
      FROM vector_top_k('idx_${this.table}_${this.column}', vector(:queryVector), CAST(:k AS INTEGER)) as top_k
      JOIN ${this.table} ON top_k.rowid = ${this.table}.rowid`,
      args: { queryVector, k },
    };

    const results = await this.db.execute(sql);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.rows.map((row: any) => {
      const metadata = JSON.parse(row.metadata);

      const doc = new Document({
        id: String(row.id),
        metadata,
        pageContent: row.content,
      });

      return [doc, row.distance];
    });
  }

  /**
   * Deletes vectors from the store.
   * @param {Object} params - Delete parameters.
   * @param {string[] | number[]} [params.ids] - The ids of the vectors to delete.
   * @returns {Promise<void>}
   */
  async delete(params: {
    ids?: string[] | number[];
    deleteAll?: boolean;
  }): Promise<void> {
    if (params.deleteAll) {
      await this.db.execute(`DELETE FROM ${this.table}`);
    } else if (params.ids !== undefined) {
      await this.db.batch(
        params.ids.map((id) => ({
          sql: `DELETE FROM ${this.table} WHERE rowid = :id`,
          args: { id },
        }))
      );
    } else {
      throw new Error(
        `You must provide an "ids" parameter or a "deleteAll" parameter.`
      );
    }
  }

  /**
   * Creates a new LibSQLVectorStore instance from texts.
   * @param {string[]} texts - The texts to add to the store.
   * @param {object[] | object} metadatas - The metadata for the texts.
   * @param {EmbeddingsInterface} embeddings - The embeddings interface to use.
   * @param {Client} dbClient - The LibSQL client instance.
   * @param {LibSQLVectorStoreArgs} [options] - Configuration options for the vector store.
   * @returns {Promise<LibSQLVectorStore>} A new LibSQLVectorStore instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    options: LibSQLVectorStoreArgs
  ): Promise<LibSQLVectorStore> {
    const docs = texts.map((text, i) => {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;

      return new Document({ pageContent: text, metadata });
    });

    return LibSQLVectorStore.fromDocuments(docs, embeddings, options);
  }

  /**
   * Creates a new LibSQLVectorStore instance from documents.
   * @param {Document[]} docs - The documents to add to the store.
   * @param {EmbeddingsInterface} embeddings - The embeddings interface to use.
   * @param {Client} dbClient - The LibSQL client instance.
   * @param {LibSQLVectorStoreArgs} [options] - Configuration options for the vector store.
   * @returns {Promise<LibSQLVectorStore>} A new LibSQLVectorStore instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    options: LibSQLVectorStoreArgs
  ): Promise<LibSQLVectorStore> {
    const instance = new this(embeddings, options);

    await instance.addDocuments(docs);

    return instance;
  }
}
