import type { Pool, MysqlError, PoolConnection } from "mysql";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";



export interface SingleStoreVectorStoreConfig {
  connectionPool: Pool;
  tableName?: string;
  contentColumnName?: string;
  vectorColumnName?: string;
  metadataColumnName?: string; 
}

export class SingleStoreVectorStore extends VectorStore {
  
  connectionPool: Pool;

  tableName: string;

  contentColumnName: string;

  vectorColumnName: string;

  metadataColumnName: string;

  constructor(embeddings: Embeddings, config: SingleStoreVectorStoreConfig) {
    super(embeddings, config);
    this.connectionPool = config.connectionPool;
    this.tableName = config.tableName ?? "embeddings";
    this.contentColumnName = config.contentColumnName ?? "content";
    this.vectorColumnName = config.vectorColumnName ?? "vector";
    this.metadataColumnName = config.metadataColumnName ?? "metadata";
  }

  createTableIfNotExists(): Promise<void> {
    const createQuery = `CREATE TABLE IF NOT EXISTS ${this.tableName} (${this.contentColumnName} TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci, ${this.vectorColumnName} BLOB, ${this.metadataColumnName} JSON);`;
    return new Promise((resolve, reject) => {
      this.connectionPool.getConnection((err: MysqlError | null, connection: PoolConnection) => {
        if (err) reject(err);
        connection.query(createQuery, (err: MysqlError, result?: undefined) => {
          connection.release();
          if (err) reject(err);
          resolve(result);
        });
      });
    });
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents);
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    await this.createTableIfNotExists();
    const {tableName} = this;
    return new Promise((resolve, reject) => {
      this.connectionPool.getConnection((err: MysqlError, connection: PoolConnection) => {
        if (err) reject(err);
        vectors.forEach((vector, idx) => {
          const insertQuery = `INSERT INTO ${tableName} VALUES ('${documents[idx].pageContent}', JSON_ARRAY_PACK('[${vector}]'), '${JSON.stringify(documents[idx].metadata)}');`;
          connection.query(insertQuery, (err: MysqlError) => {
            if (err) reject(err);
          });
        });
        connection.release();
        resolve();
      });
    });
  }

  async similaritySearchVectorWithScore(query: number[], k: number, _filter?: undefined): Promise<[Document, number][]> {
    const contentColumn = this.contentColumnName;
    const metadataColumn = this.metadataColumnName;
    // use vector DOT_PRODUCT as a distance function 
    const searchQuery = `SELECT ${this.contentColumnName}, ${this.metadataColumnName}, DOT_PRODUCT(${this.vectorColumnName}, JSON_ARRAY_PACK('[${query}]')) as __score  FROM ${this.tableName} ORDER BY __score DESC LIMIT ${k}`;
    return new Promise((resolve, reject) => {
      this.connectionPool.getConnection((err: MysqlError, connection: PoolConnection) => {
        if (err) reject(err);
        connection.query(searchQuery, (err: MysqlError, rows: any[]) => {
          connection.release();
          if (err) reject(err);
          const result: [Document, number][] = [];
          for (const res of rows) {
            result.push([
                new Document({
                    pageContent: res[contentColumn],
                    metadata: JSON.parse(res[metadataColumn]),
                }),
                Number(res.__score),
            ]);
          }
          resolve(result);
        });
      });
    });
  }

  static async fromTexts(texts: string[], metadatas: object[], embeddings: Embeddings, dbConfig: SingleStoreVectorStoreConfig): Promise<SingleStoreVectorStore> {
    const docs = texts.map((text, idx) => {
      const metadata = Array.isArray(metadatas) ? metadatas[idx] : metadatas;
      return new Document({
        pageContent: text,
        metadata,
      });
    });
    return SingleStoreVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(docs: Document[], embeddings: Embeddings, dbConfig: SingleStoreVectorStoreConfig): Promise<SingleStoreVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
