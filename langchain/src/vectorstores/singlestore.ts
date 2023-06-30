import type {
  Pool,
  RowDataPacket,
  OkPacket,
  ResultSetHeader,
  FieldPacket,
  PoolOptions,
} from "mysql2/promise";
import { format } from "mysql2";
import { createPool } from "mysql2/promise";
import { Metadata } from "@opensearch-project/opensearch/api/types.js";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export enum DistanceMetrics {
  DOT_PRODUCT = "DOT_PRODUCT",
  EUCLIDEAN_DISTANCE = "EUCLIDEAN_DISTANCE",
}

const OrderingDirective: Record<DistanceMetrics, string> = {
  [DistanceMetrics.DOT_PRODUCT]: "DESC",
  [DistanceMetrics.EUCLIDEAN_DISTANCE]: "",
};

export interface ConnectionOptions extends PoolOptions {}

type ConnectionWithUri = {
  connectionOptions?: never;
  connectionURI: string;
};

type ConnectionWithOptions = {
  connectionURI?: never;
  connectionOptions: ConnectionOptions;
};

type ConnectionConfig = ConnectionWithUri | ConnectionWithOptions;

export type SingleStoreVectorStoreConfig = ConnectionConfig & {
  tableName?: string;
  contentColumnName?: string;
  vectorColumnName?: string;
  metadataColumnName?: string;
  distanceMetric?: DistanceMetrics;
};

function withConnectAttributes(
  config: SingleStoreVectorStoreConfig
): ConnectionOptions {
  let newOptions: ConnectionOptions = {};
  if (config.connectionURI) {
    newOptions = {
      uri: config.connectionURI,
    };
  } else if (config.connectionOptions) {
    newOptions = {
      ...config.connectionOptions,
    };
  }
  const result: ConnectionOptions = {
    ...newOptions,
    connectAttributes: {
      ...newOptions.connectAttributes,
    },
  };

  if (!result.connectAttributes) {
    result.connectAttributes = {};
  }

  if (result.connectAttributes.program_name === undefined) {
    result.connectAttributes = {
      ...result.connectAttributes,
      program_name: "langchain js sdk",
      program_version: "0.0.97",
    };
  }
  return result;
}

export class SingleStoreVectorStore extends VectorStore {
  connectionPool: Pool;

  tableName: string;

  contentColumnName: string;

  vectorColumnName: string;

  metadataColumnName: string;

  distanceMetrics: DistanceMetrics;

  constructor(embeddings: Embeddings, config: SingleStoreVectorStoreConfig) {
    super(embeddings, config);
    this.connectionPool = createPool(withConnectAttributes(config));
    this.tableName = config.tableName ?? "embeddings";
    this.contentColumnName = config.contentColumnName ?? "content";
    this.vectorColumnName = config.vectorColumnName ?? "vector";
    this.metadataColumnName = config.metadataColumnName ?? "metadata";
    this.distanceMetrics =
      config.distanceMetric ?? DistanceMetrics.DOT_PRODUCT;
  }

  async createTableIfNotExists(): Promise<void> {
    await this.connectionPool
      .execute(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
      ${this.contentColumnName} TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
      ${this.vectorColumnName} BLOB,
      ${this.metadataColumnName} JSON);`);
  }

  async end(): Promise<void> {
    return this.connectionPool.end();
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
    filter?: Metadata
  ): Promise<[Document, number][]> {
    // build the where clause from filter
    const whereArgs: string[] = [];
    const buildWhereClause = (record: Metadata, argList: string[]): string => {
      const whereTokens: string[] = [];
      for (const key in record)
        if (record[key] !== undefined) {
          if (
            typeof record[key] === "object" &&
            record[key] != null &&
            !Array.isArray(record[key])
          ) {
            whereTokens.push(
              buildWhereClause(record[key], argList.concat([key]))
            );
          } else {
            whereTokens.push(
              `JSON_EXTRACT_JSON(${this.metadataColumnName}, `.concat(
                Array.from({ length: argList.length + 1 }, () => "?").join(
                  ", "
                ),
                ") = ?"
              )
            );
            whereArgs.push(...argList, key, JSON.stringify(record[key]));
          }
        }
      return whereTokens.join(" AND ");
    };
    const whereClause = filter
      ? "WHERE ".concat(buildWhereClause(filter, []))
      : "";

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
      ${this.distanceMetrics}(${
          this.vectorColumnName
        }, JSON_ARRAY_PACK('[?]')) as __score FROM ${
          this.tableName
        } ${whereClause}
      ORDER BY __score ${OrderingDirective[this.distanceMetrics]} LIMIT ?;`,
        [query, ...whereArgs, k]
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
