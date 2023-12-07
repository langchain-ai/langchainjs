import * as uuid from "uuid";
import { ClickHouseClient, createClient } from "@clickhouse/client";

import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

/**
 * Arguments for the MyScaleStore class, which include the host, port,
 * protocol, username, password, index type, index parameters, column map,
 * database, table, and metric.
 */
export interface MyScaleLibArgs {
  host: string;
  port: string | number;
  protocol?: string;
  username: string;
  password: string;
  indexType?: string;
  indexParam?: Record<string, string>;
  columnMap?: ColumnMap;
  database?: string;
  table?: string;
  metric?: metric;
}

/**
 * Mapping of columns in the MyScale database.
 */
export interface ColumnMap {
  id: string;
  text: string;
  vector: string;
  metadata: string;
}

/**
 * Type of metric used in the MyScale database.
 */
export type metric = "L2" | "Cosine" | "IP";

/**
 * Type for filtering search results in the MyScale database.
 */
export interface MyScaleFilter {
  whereStr: string;
}

/**
 * Class for interacting with the MyScale database. It extends the
 * VectorStore class and provides methods for adding vectors and
 * documents, searching for similar vectors, and creating instances from
 * texts or documents.
 */
export class MyScaleStore extends VectorStore {
  declare FilterType: MyScaleFilter;

  private client: ClickHouseClient;

  private indexType: string;

  private indexParam: Record<string, string>;

  private columnMap: ColumnMap;

  private database: string;

  private table: string;

  private metric: metric;

  private isInitialized = false;

  _vectorstoreType(): string {
    return "myscale";
  }

  constructor(embeddings: Embeddings, args: MyScaleLibArgs) {
    super(embeddings, args);

    this.indexType = args.indexType || "MSTG";
    this.indexParam = args.indexParam || {};
    this.columnMap = args.columnMap || {
      id: "id",
      text: "text",
      vector: "vector",
      metadata: "metadata",
    };
    this.database = args.database || "default";
    this.table = args.table || "vector_table";
    this.metric = args.metric || "Cosine";

    this.client = createClient({
      host: `${args.protocol ?? "https://"}${args.host}:${args.port}`,
      username: args.username,
      password: args.password,
      session_id: uuid.v4(),
    });
  }

  /**
   * Method to add vectors to the MyScale database.
   * @param vectors The vectors to add.
   * @param documents The documents associated with the vectors.
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    if (!this.isInitialized) {
      await this.initialize(vectors[0].length);
    }

    const queryStr = this.buildInsertQuery(vectors, documents);
    await this.client.exec({ query: queryStr });
  }

  /**
   * Method to add documents to the MyScale database.
   * @param documents The documents to add.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents
    );
  }

  /**
   * Method to search for vectors that are similar to a given query vector.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional filter for the search results.
   * @returns Promise that resolves with an array of tuples, each containing a Document and a score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    if (!this.isInitialized) {
      await this.initialize(query.length);
    }
    const queryStr = this.buildSearchQuery(query, k, filter);

    const queryResultSet = await this.client.query({ query: queryStr });
    const queryResult: {
      data: { text: string; metadata: object; dist: number }[];
    } = await queryResultSet.json();

    const result: [Document, number][] = queryResult.data.map((item) => [
      new Document({ pageContent: item.text, metadata: item.metadata }),
      item.dist,
    ]);

    return result;
  }

  /**
   * Static method to create an instance of MyScaleStore from texts.
   * @param texts The texts to use.
   * @param metadatas The metadata associated with the texts.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the MyScaleStore.
   * @returns Promise that resolves with a new instance of MyScaleStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: Embeddings,
    args: MyScaleLibArgs
  ): Promise<MyScaleStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return MyScaleStore.fromDocuments(docs, embeddings, args);
  }

  /**
   * Static method to create an instance of MyScaleStore from documents.
   * @param docs The documents to use.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the MyScaleStore.
   * @returns Promise that resolves with a new instance of MyScaleStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    args: MyScaleLibArgs
  ): Promise<MyScaleStore> {
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method to create an instance of MyScaleStore from an existing
   * index.
   * @param embeddings The embeddings to use.
   * @param args The arguments for the MyScaleStore.
   * @returns Promise that resolves with a new instance of MyScaleStore.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    args: MyScaleLibArgs
  ): Promise<MyScaleStore> {
    const instance = new this(embeddings, args);

    await instance.initialize();
    return instance;
  }

  /**
   * Method to initialize the MyScale database.
   * @param dimension Optional dimension of the vectors.
   * @returns Promise that resolves when the database has been initialized.
   */
  private async initialize(dimension?: number): Promise<void> {
    const dim = dimension ?? (await this.embeddings.embedQuery("test")).length;

    let indexParamStr = "";
    for (const [key, value] of Object.entries(this.indexParam)) {
      indexParamStr += `, '${key}=${value}'`;
    }

    const query = `
      CREATE TABLE IF NOT EXISTS ${this.database}.${this.table}(
        ${this.columnMap.id} String,
        ${this.columnMap.text} String,
        ${this.columnMap.vector} Array(Float32),
        ${this.columnMap.metadata} JSON,
        CONSTRAINT cons_vec_len CHECK length(${this.columnMap.vector}) = ${dim},
        VECTOR INDEX vidx ${this.columnMap.vector} TYPE ${this.indexType}('metric_type=${this.metric}'${indexParamStr})
      ) ENGINE = MergeTree ORDER BY ${this.columnMap.id}
    `;

    await this.client.exec({ query: "SET allow_experimental_object_type=1" });
    await this.client.exec({
      query: "SET output_format_json_named_tuples_as_objects = 1",
    });
    await this.client.exec({ query });
    this.isInitialized = true;
  }

  /**
   * Method to build an SQL query for inserting vectors and documents into
   * the MyScale database.
   * @param vectors The vectors to insert.
   * @param documents The documents to insert.
   * @returns The SQL query string.
   */
  private buildInsertQuery(vectors: number[][], documents: Document[]): string {
    const columnsStr = Object.values(this.columnMap).join(", ");

    const data: string[] = [];
    for (let i = 0; i < vectors.length; i += 1) {
      const vector = vectors[i];
      const document = documents[i];
      const item = [
        `'${uuid.v4()}'`,
        `'${this.escapeString(document.pageContent)}'`,
        `[${vector}]`,
        `'${JSON.stringify(document.metadata)}'`,
      ].join(", ");
      data.push(`(${item})`);
    }
    const dataStr = data.join(", ");

    return `
      INSERT INTO TABLE
        ${this.database}.${this.table}(${columnsStr})
      VALUES
        ${dataStr}
    `;
  }

  private escapeString(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  /**
   * Method to build an SQL query for searching for similar vectors in the
   * MyScale database.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional filter for the search results.
   * @returns The SQL query string.
   */
  private buildSearchQuery(
    query: number[],
    k: number,
    filter?: MyScaleFilter
  ): string {
    const order = this.metric === "IP" ? "DESC" : "ASC";

    const whereStr = filter ? `PREWHERE ${filter.whereStr}` : "";
    return `
      SELECT ${this.columnMap.text} AS text, ${this.columnMap.metadata} AS metadata, dist
      FROM ${this.database}.${this.table}
      ${whereStr}
      ORDER BY distance(${this.columnMap.vector}, [${query}]) AS dist ${order}
      LIMIT ${k}
    `;
  }
}
