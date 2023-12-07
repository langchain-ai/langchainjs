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
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Metadata = Record<string, any>;

export type DistanceMetrics = "DOT_PRODUCT" | "EUCLIDEAN_DISTANCE";

const OrderingDirective: Record<DistanceMetrics, string> = {
  DOT_PRODUCT: "DESC",
  EUCLIDEAN_DISTANCE: "",
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

  result.connectAttributes = {
    ...result.connectAttributes,
    _connector_name: "langchain js sdk",
    _connector_version: "1.0.0",
    _driver_name: "Node-MySQL-2",
  };

  return result;
}

/**
 * Class for interacting with SingleStoreDB, a high-performance
 * distributed SQL database. It provides vector storage and vector
 * functions.
 */
export class SingleStoreVectorStore extends VectorStore {
  connectionPool: Pool;

  tableName: string;

  contentColumnName: string;

  vectorColumnName: string;

  metadataColumnName: string;

  distanceMetric: DistanceMetrics;

  _vectorstoreType(): string {
    return "singlestore";
  }

  constructor(embeddings: Embeddings, config: SingleStoreVectorStoreConfig) {
    super(embeddings, config);
    this.connectionPool = createPool(withConnectAttributes(config));
    this.tableName = config.tableName ?? "embeddings";
    this.contentColumnName = config.contentColumnName ?? "content";
    this.vectorColumnName = config.vectorColumnName ?? "vector";
    this.metadataColumnName = config.metadataColumnName ?? "metadata";
    this.distanceMetric = config.distanceMetric ?? "DOT_PRODUCT";
  }

  /**
   * Creates a new table in the SingleStoreDB database if it does not
   * already exist.
   */
  async createTableIfNotExists(): Promise<void> {
    await this.connectionPool
      .execute(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
      ${this.contentColumnName} TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
      ${this.vectorColumnName} BLOB,
      ${this.metadataColumnName} JSON);`);
  }

  /**
   * Ends the connection to the SingleStoreDB database.
   */
  async end(): Promise<void> {
    return this.connectionPool.end();
  }

  /**
   * Adds new documents to the SingleStoreDB database.
   * @param documents An array of Document objects.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents);
  }

  /**
   * Adds new vectors to the SingleStoreDB database.
   * @param vectors An array of vectors.
   * @param documents An array of Document objects.
   */
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

  /**
   * Performs a similarity search on the vectors stored in the SingleStoreDB
   * database.
   * @param query An array of numbers representing the query vector.
   * @param k The number of nearest neighbors to return.
   * @param filter Optional metadata to filter the vectors by.
   * @returns Top matching vectors with score
   */
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
      ${this.distanceMetric}(${
          this.vectorColumnName
        }, JSON_ARRAY_PACK('[?]')) as __score FROM ${
          this.tableName
        } ${whereClause}
      ORDER BY __score ${OrderingDirective[this.distanceMetric]} LIMIT ?;`,
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

  /**
   * Creates a new instance of the SingleStoreVectorStore class from a list
   * of texts.
   * @param texts An array of strings.
   * @param metadatas An array of metadata objects.
   * @param embeddings An Embeddings object.
   * @param dbConfig A SingleStoreVectorStoreConfig object.
   * @returns A new SingleStoreVectorStore instance
   */
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

  /**
   * Creates a new instance of the SingleStoreVectorStore class from a list
   * of Document objects.
   * @param docs An array of Document objects.
   * @param embeddings An Embeddings object.
   * @param dbConfig A SingleStoreVectorStoreConfig object.
   * @returns A new SingleStoreVectorStore instance
   */
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
