import * as uuid from "uuid";
import pg, { Pool, PoolConfig } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

const _LANGCHAIN_DEFAULT_EMBEDDING_DIM = 1536;
const _LANGCHAIN_DEFAULT_COLLECTION_NAME = "langchain_document";

export interface AnalyticDBArgs {
  connectionOptions: PoolConfig;
  embeddingDimension?: number;
  collectionName?: string;
  preDeleteCollection?: boolean;
}

interface DataType {
  id: string;
  embedding: number[];
  document: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export class AnalyticDBVectorStore extends VectorStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare FilterType: Record<string, any>;

  private pool: Pool;

  private embeddingDimension: number;

  private collectionName: string;

  private preDeleteCollection: boolean;

  private isCreateCollection = false;

  _vectorstoreType(): string {
    return "analyticdb";
  }

  constructor(embeddings: Embeddings, args: AnalyticDBArgs) {
    super(embeddings, args);

    this.pool = new pg.Pool({
      host: args.connectionOptions.host,
      port: args.connectionOptions.port,
      database: args.connectionOptions.database,
      user: args.connectionOptions.user,
      password: args.connectionOptions.password,
    });
    this.embeddingDimension =
      args.embeddingDimension || _LANGCHAIN_DEFAULT_EMBEDDING_DIM;
    this.collectionName =
      args.collectionName || _LANGCHAIN_DEFAULT_COLLECTION_NAME;
    this.preDeleteCollection = args.preDeleteCollection || false;
  }

  async end(): Promise<void> {
    return this.pool.end();
  }

  async createTableIfNotExists(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Create the table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.collectionName} (
          id TEXT PRIMARY KEY DEFAULT NULL,
          embedding REAL[],
          document TEXT,
          metadata JSON
        );
      `);

      // Check if the index exists
      const indexName = `${this.collectionName}_embedding_idx`;
      const indexQuery = `
        SELECT 1
        FROM pg_indexes
        WHERE indexname = '${indexName}';
      `;
      const result = await client.query(indexQuery);

      // Create the index if it doesn't exist
      if (result.rowCount === 0) {
        const indexStatement = `
          CREATE INDEX ${indexName}
          ON ${this.collectionName} USING ann(embedding)
          WITH (
            "dim" = ${this.embeddingDimension},
            "hnsw_m" = 100
          );
        `;
        await client.query(indexStatement);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteCollection(): Promise<void> {
    const dropStatement = `DROP TABLE IF EXISTS ${this.collectionName};`;
    await this.pool.query(dropStatement);
  }

  async createCollection(): Promise<void> {
    if (this.preDeleteCollection) {
      await this.deleteCollection();
    }
    await this.createTableIfNotExists();
    this.isCreateCollection = true;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and documents must have the same length`);
    }
    if (vectors[0].length !== this.embeddingDimension) {
      throw new Error(
        `Vectors must have the same length as the number of dimensions (${this.embeddingDimension})`
      );
    }

    if (!this.isCreateCollection) {
      await this.createCollection();
    }

    const client = await this.pool.connect();
    try {
      const chunkSize = 500;
      const chunksTableData: DataType[] = [];

      for (let i = 0; i < documents.length; i += 1) {
        chunksTableData.push({
          id: uuid.v4(),
          embedding: vectors[i],
          document: documents[i].pageContent,
          metadata: documents[i].metadata,
        });

        // Execute the batch insert when the batch size is reached
        if (chunksTableData.length === chunkSize) {
          const rs = new Readable();
          let currentIndex = 0;
          rs._read = function () {
            if (currentIndex === chunkSize) {
              rs.push(null);
            } else {
              const data = chunksTableData[currentIndex];
              rs.push(
                `${data.id}\t{${data.embedding.join(",")}}\t${
                  data.document
                }\t${JSON.stringify(data.metadata)}\n`
              );
              currentIndex += 1;
            }
          };
          const ws = client.query(
            copyFrom(
              `COPY ${this.collectionName}(id, embedding, document, metadata) FROM STDIN`
            )
          );

          await pipeline(rs, ws);
          // Clear the chunksTableData list for the next batch
          chunksTableData.length = 0;
        }
      }

      // Insert any remaining records that didn't make up a full batch
      if (chunksTableData.length > 0) {
        const rs = new Readable();
        let currentIndex = 0;
        rs._read = function () {
          if (currentIndex === chunksTableData.length) {
            rs.push(null);
          } else {
            const data = chunksTableData[currentIndex];
            rs.push(
              `${data.id}\t{${data.embedding.join(",")}}\t${
                data.document
              }\t${JSON.stringify(data.metadata)}\n`
            );
            currentIndex += 1;
          }
        };
        const ws = client.query(
          copyFrom(
            `COPY ${this.collectionName}(id, embedding, document, metadata) FROM STDIN`
          )
        );
        await pipeline(rs, ws);
      }
    } finally {
      client.release();
    }
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    if (!this.isCreateCollection) {
      await this.createCollection();
    }

    let filterCondition = "";
    const filterEntries = filter ? Object.entries(filter) : [];
    if (filterEntries.length > 0) {
      const conditions = filterEntries.map(
        (_, index) => `metadata->>$${2 * index + 3} = $${2 * index + 4}`
      );
      filterCondition = `WHERE ${conditions.join(" AND ")}`;
    }

    const sqlQuery = `
      SELECT *, l2_distance(embedding, $1::real[]) AS distance
      FROM ${this.collectionName}
      ${filterCondition}
      ORDER BY embedding <-> $1
      LIMIT $2;
    `;

    // Execute the query and fetch the results
    const { rows } = await this.pool.query(sqlQuery, [
      query,
      k,
      ...filterEntries.flatMap(([key, value]) => [key, value]),
    ]);

    const result: [Document, number][] = rows.map((row) => [
      new Document({ pageContent: row.document, metadata: row.metadata }),
      row.distance,
    ]);

    return result;
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: AnalyticDBArgs
  ): Promise<AnalyticDBVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return AnalyticDBVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: AnalyticDBArgs
  ): Promise<AnalyticDBVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: AnalyticDBArgs
  ): Promise<AnalyticDBVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.createCollection();
    return instance;
  }
}
