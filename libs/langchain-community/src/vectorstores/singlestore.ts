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
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { Callbacks } from "@langchain/core/callbacks/manager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Metadata = Record<string, any>;

export type DistanceMetrics = "DOT_PRODUCT" | "EUCLIDEAN_DISTANCE";

export type SearchStrategy =
  | "VECTOR_ONLY"
  | "TEXT_ONLY"
  | "FILTER_BY_TEXT"
  | "FILTER_BY_VECTOR"
  | "WEIGHTED_SUM";

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

type SearchConfig = {
  searchStrategy?: SearchStrategy;
  filterThreshold?: number;
  textWeight?: number;
  vectorWeight?: number;
  vectorselectCountMultiplier?: number;
};

export type SingleStoreVectorStoreConfig = ConnectionConfig & {
  tableName?: string;
  idColumnName?: string;
  contentColumnName?: string;
  vectorColumnName?: string;
  metadataColumnName?: string;
  distanceMetric?: DistanceMetrics;
  useVectorIndex?: boolean;
  vectorIndexName?: string;
  vectorIndexOptions?: Metadata;
  vectorSize?: number;
  useFullTextIndex?: boolean;
  searchConfig?: SearchConfig;
};

/**
 * Adds the connect attributes to the connection options.
 * @param config A SingleStoreVectorStoreConfig object.
 */
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
    _connector_version: "2.0.0",
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

  idColumnName: string;

  contentColumnName: string;

  vectorColumnName: string;

  metadataColumnName: string;

  distanceMetric: DistanceMetrics;

  useVectorIndex: boolean;

  vectorIndexName: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vectorIndexOptions: Metadata;

  vectorSize: number;

  useFullTextIndex: boolean;

  searchConfig: SearchConfig;

  _vectorstoreType(): string {
    return "singlestore";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    config: SingleStoreVectorStoreConfig
  ) {
    super(embeddings, config);
    this.connectionPool = createPool(withConnectAttributes(config));
    this.tableName = config.tableName ?? "embeddings";
    this.idColumnName = config.idColumnName ?? "id";
    this.contentColumnName = config.contentColumnName ?? "content";
    this.vectorColumnName = config.vectorColumnName ?? "vector";
    this.metadataColumnName = config.metadataColumnName ?? "metadata";
    this.distanceMetric = config.distanceMetric ?? "DOT_PRODUCT";
    this.useVectorIndex = config.useVectorIndex ?? false;
    this.vectorIndexName = config.vectorIndexName ?? "";
    this.vectorIndexOptions = config.vectorIndexOptions ?? {};
    this.vectorSize = config.vectorSize ?? 1536;
    this.useFullTextIndex = config.useFullTextIndex ?? false;
    this.searchConfig = config.searchConfig ?? {
      searchStrategy: "VECTOR_ONLY",
      filterThreshold: 1.0,
      textWeight: 0.5,
      vectorWeight: 0.5,
      vectorselectCountMultiplier: 10,
    };
  }

  /**
   * Creates a new table in the SingleStoreDB database if it does not
   * already exist.
   */
  async createTableIfNotExists(): Promise<void> {
    let fullTextIndex = "";
    if (this.useFullTextIndex) {
      fullTextIndex = `, FULLTEXT(${this.contentColumnName})`;
    }
    if (this.useVectorIndex) {
      let vectorIndexOptions = "";
      if (Object.keys(this.vectorIndexOptions).length > 0) {
        vectorIndexOptions = `INDEX_OPTIONS '${JSON.stringify(
          this.vectorIndexOptions
        )}'`;
      }
      await this.connectionPool
        .execute(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
          ${this.idColumnName} BIGINT AUTO_INCREMENT PRIMARY KEY,
          ${this.contentColumnName} LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          ${this.vectorColumnName} VECTOR(${this.vectorSize}, F32) NOT NULL,
          ${this.metadataColumnName} JSON,
          VECTOR INDEX ${this.vectorIndexName} (${this.vectorColumnName}) ${vectorIndexOptions}
          ${fullTextIndex});`);
    } else {
      await this.connectionPool
        .execute(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
        ${this.idColumnName} BIGINT AUTO_INCREMENT PRIMARY KEY,
        ${this.contentColumnName} LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
        ${this.vectorColumnName} BLOB,
        ${this.metadataColumnName} JSON
        ${fullTextIndex});`);
    }
  }

  /**
   * Ends the connection to the SingleStoreDB database.
   */
  async end(): Promise<void> {
    return this.connectionPool.end();
  }

  /**
   * Sets the search configuration for the SingleStoreVectorStore instance.
   * @param config A SearchConfig object.
   */
  async setSearchConfig(config: SearchConfig): Promise<void> {
    this.searchConfig = {
      searchStrategy: config.searchStrategy ?? "VECTOR_ONLY",
      filterThreshold: config.filterThreshold ?? 1.0,
      textWeight: config.textWeight ?? 0.5,
      vectorWeight: config.vectorWeight ?? 0.5,
      vectorselectCountMultiplier: config.vectorselectCountMultiplier ?? 10,
    };
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
          await this.connectionPool.query(
            format(
              `INSERT INTO ${tableName}(
                ${this.contentColumnName},
                ${this.vectorColumnName},
                ${this.metadataColumnName})
                VALUES (?, JSON_ARRAY_PACK('[?]'), ?);`,
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
    if (this.useFullTextIndex || this.useVectorIndex) {
      await this.connectionPool.query(`OPTIMIZE TABLE ${tableName} FLUSH;`);
    }
  }

  /**
   *
   * Performs a similarity search on the texts stored in the SingleStoreDB
   * using the specified search strategy and distance metric.
   * @param query A string representing the query text.
   * @param vector An array of numbers representing the query vector.
   * @param k The number of nearest neighbors to return.
   * @param filter Optional metadata to filter the texts by.
   * @returns Top matching documents with score
   */
  async similaritySearchTextAndVectorWithScore(
    query: string,
    vector: number[],
    k: number,
    filter?: Metadata
  ): Promise<[Document, number][]> {
    if (!this.searchConfig.searchStrategy) {
      throw new Error("Search strategy is required.");
    }
    if (
      this.searchConfig.searchStrategy !== "VECTOR_ONLY" &&
      !this.useFullTextIndex
    ) {
      throw new Error(
        "Full text index is required for text-based search strategies."
      );
    }
    if (
      (this.searchConfig.searchStrategy === "FILTER_BY_TEXT" ||
        this.searchConfig.searchStrategy === "FILTER_BY_VECTOR") &&
      !this.searchConfig.filterThreshold &&
      this.searchConfig.filterThreshold !== 0
    ) {
      throw new Error(
        "Filter threshold is required for filter-based search strategies."
      );
    }
    if (
      this.searchConfig.searchStrategy === "WEIGHTED_SUM" &&
      ((!this.searchConfig.textWeight && this.searchConfig.textWeight !== 0) ||
        (!this.searchConfig.vectorWeight &&
          this.searchConfig.vectorWeight !== 0) ||
        (!this.searchConfig.vectorselectCountMultiplier &&
          this.searchConfig.vectorselectCountMultiplier !== 0))
    ) {
      throw new Error(
        "Text and vector weight and vector select count multiplier are required for weighted sum search strategy."
      );
    }
    if (
      this.searchConfig.searchStrategy === "WEIGHTED_SUM" &&
      this.distanceMetric !== "DOT_PRODUCT"
    ) {
      throw new Error(
        "Weighted sum search strategy is only available for DOT_PRODUCT distance metric."
      );
    }
    const filterThreshold = this.searchConfig.filterThreshold ?? 1.0;
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
    const filterByTextClause = (): string => {
      whereArgs.push(query, filterThreshold.toString());
      return `MATCH (${this.contentColumnName}) AGAINST (?) > ?`;
    };
    const filterByVectorClause = (): string => {
      whereArgs.push(JSON.stringify(vector), filterThreshold.toString());
      return this.distanceMetric === "DOT_PRODUCT"
        ? `${this.distanceMetric}(${this.vectorColumnName}, JSON_ARRAY_PACK(?)) > ?`
        : `${this.distanceMetric}(${this.vectorColumnName}, JSON_ARRAY_PACK(?)) < ?`;
    };
    const whereClauses: string[] = [];
    if (filter) {
      whereClauses.push(buildWhereClause(filter, []));
    }
    if (this.searchConfig.searchStrategy === "FILTER_BY_TEXT") {
      whereClauses.push(filterByTextClause());
    }
    if (this.searchConfig.searchStrategy === "FILTER_BY_VECTOR") {
      whereClauses.push(filterByVectorClause());
    }
    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let queryText = "";
    switch (this.searchConfig.searchStrategy) {
      case "TEXT_ONLY":
      case "FILTER_BY_VECTOR":
        queryText = format(
          `SELECT ${this.contentColumnName}, ${this.metadataColumnName},
          MATCH (${this.contentColumnName}) AGAINST (?) as __score
          FROM ${this.tableName} ${whereClause} ORDER BY __score DESC LIMIT ?;`,
          [query, ...whereArgs, k]
        );
        break;
      case "VECTOR_ONLY":
      case "FILTER_BY_TEXT":
        queryText = format(
          `SELECT ${this.contentColumnName}, ${this.metadataColumnName},
          ${this.distanceMetric}(${
            this.vectorColumnName
          }, JSON_ARRAY_PACK('[?]')) as __score
          FROM ${this.tableName} ${whereClause} ORDER BY __score ${
            OrderingDirective[this.distanceMetric]
          } LIMIT ?;`,
          [vector, ...whereArgs, k]
        );
        break;
      case "WEIGHTED_SUM":
        queryText = format(
          `SELECT ${this.contentColumnName}, ${
            this.metadataColumnName
          }, __score1 * ? + __score2 * ? as __score
          FROM (
              SELECT ${this.idColumnName}, ${this.contentColumnName}, ${
            this.metadataColumnName
          }, MATCH (${this.contentColumnName}) AGAINST (?) as __score1 
          FROM ${this.tableName} ${whereClause}) r1 FULL OUTER JOIN (
              SELECT ${this.idColumnName}, ${this.distanceMetric}(${
            this.vectorColumnName
          }, JSON_ARRAY_PACK('[?]')) as __score2
              FROM ${this.tableName} ${whereClause} ORDER BY __score2 ${
            OrderingDirective[this.distanceMetric]
          } LIMIT ?
          ) r2 ON r1.${this.idColumnName} = r2.${
            this.idColumnName
          } ORDER BY __score ${OrderingDirective[this.distanceMetric]} LIMIT ?`,
          [
            this.searchConfig.textWeight,
            this.searchConfig.vectorWeight,
            query,
            ...whereArgs,
            vector,
            ...whereArgs,
            k * (this.searchConfig.vectorselectCountMultiplier ?? 10),
            k,
          ]
        );
        break;
      default:
        throw new Error("Invalid search strategy.");
    }
    const [rows]: [
      (
        | RowDataPacket[]
        | RowDataPacket[][]
        | OkPacket
        | OkPacket[]
        | ResultSetHeader
      ),
      FieldPacket[]
    ] = await this.connectionPool.query(queryText);
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
   * Performs a similarity search on the texts stored in the SingleStoreDB
   * @param query A string representing the query text.
   * @param k The number of nearest neighbors to return. By default, it is 4.
   * @param filter Optional metadata to filter the texts by.
   * @param _callbacks - Callbacks object, not used in this implementation.
   * @returns Top matching documents
   */
  async similaritySearch(
    query: string,
    k?: number,
    filter?: Metadata,
    _callbacks?: Callbacks | undefined
  ): Promise<DocumentInterface<Metadata>[]> {
    // @typescript-eslint/no-explicit-any
    const queryVector = await this.embeddings.embedQuery(query);
    return this.similaritySearchTextAndVectorWithScore(
      query,
      queryVector,
      k ?? 4,
      filter
    ).then((result) => result.map(([doc]) => doc));
  }

  /**
   * Performs a similarity search on the texts stored in the SingleStoreDB
   * @param query A string representing the query text.
   * @param k The number of nearest neighbors to return. By default, it is 4.
   * @param filter Optional metadata to filter the texts by.
   * @param _callbacks
   * @returns Top matching documents with score
   */
  async similaritySearchWithScore(
    query: string,
    k?: number,
    filter?: Metadata,
    _callbacks?: Callbacks | undefined
  ): Promise<[DocumentInterface<Metadata>, number][]> {
    // @typescript-eslint/no-explicit-any
    const queryVector = await this.embeddings.embedQuery(query);
    return this.similaritySearchTextAndVectorWithScore(
      query,
      queryVector,
      k ?? 4,
      filter
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
    if (this.searchConfig.searchStrategy !== "VECTOR_ONLY") {
      throw new Error(
        "similaritySearchVectorWithScore is only available for VECTOR_ONLY search strategy."
      );
    }
    return this.similaritySearchTextAndVectorWithScore("", query, k, filter);
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
    embeddings: EmbeddingsInterface,
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
    embeddings: EmbeddingsInterface,
    dbConfig: SingleStoreVectorStoreConfig
  ): Promise<SingleStoreVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
