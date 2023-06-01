import type {
  Pool,
  RowDataPacket,
  OkPacket,
  ResultSetHeader,
  FieldPacket,
} from "mysql2/promise";
import { format } from "mysql2";
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

  async createTableIfNotExists(): Promise<void> {
    await this.connectionPool
      .execute(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
      ${this.contentColumnName} TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
      ${this.vectorColumnName} BLOB,
      ${this.metadataColumnName} JSON);`);
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents);
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    await this.createTableIfNotExists();
    const { tableName } = this;

    await Promise.all(
      vectors.map(async (vector, idx) => {
        try {
          await this.connectionPool.execute(
            format(
              `INSERT INTO ${tableName} VALUES (?, JSON_ARRAY_PACK('[?]'), ?);`,
              [
                documents[idx].pageContent,
                vector,
                JSON.stringify(documents[idx].metadata),
              ]
            )
          );
        } catch (error) {
          console.error(`Error adding vector at index ${idx}:`, error);
        }
      })
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    _filter?: undefined
  ): Promise<[Document, number][]> {
    // use vector DOT_PRODUCT as a distance function
    const [rows]: [
      (
        | RowDataPacket[]
        | RowDataPacket[][]
        | OkPacket
        | OkPacket[]
        | ResultSetHeader
      ),
      FieldPacket[]
    ] = await this.connectionPool.query(
      format(
        `SELECT ${this.contentColumnName},
      ${this.metadataColumnName},
      DOT_PRODUCT(${this.vectorColumnName}, JSON_ARRAY_PACK('[?]')) as __score FROM ${this.tableName}
      ORDER BY __score DESC LIMIT ?;`,
        [query, k]
      )
    );
    const result: [Document, number][] = [];
    for (const row of rows as RowDataPacket[]) {
      const rowData = row as unknown as Record<string, unknown>;
      result.push([
        new Document({
          pageContent: rowData[this.contentColumnName] as string,
          metadata: rowData[this.metadataColumnName] as Record<string, unknown>,
        }),
        Number(rowData.score),
      ]);
    }
    return result;
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings,
    dbConfig: SingleStoreVectorStoreConfig
  ): Promise<SingleStoreVectorStore> {
    const docs = texts.map((text, idx) => {
      const metadata = Array.isArray(metadatas) ? metadatas[idx] : metadatas;
      return new Document({
        pageContent: text,
        metadata,
      });
    });
    return SingleStoreVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: SingleStoreVectorStoreConfig
  ): Promise<SingleStoreVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
