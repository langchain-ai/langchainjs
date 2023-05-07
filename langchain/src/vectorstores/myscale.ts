import * as uuid from "uuid";
import { ClickHouseClient, createClient } from "@clickhouse/client";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

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

export interface ColumnMap {
  id: string;
  text: string;
  vector: string;
  metadata: string;
}

export type metric = "ip" | "cosine" | "l2";

export interface MyScaleFilter {
  whereStr: string;
}

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

  constructor(embeddings: Embeddings, args: MyScaleLibArgs) {
    super(embeddings, args);

    this.indexType = args.indexType || "IVFFLAT";
    this.indexParam = args.indexParam || {};
    this.columnMap = args.columnMap || {
      id: "id",
      text: "text",
      vector: "vector",
      metadata: "metadata",
    };
    this.database = args.database || "default";
    this.table = args.table || "vector_table";
    this.metric = args.metric || "cosine";

    this.client = createClient({
      host: `${args.protocol ?? "https://"}${args.host}:${args.port}`,
      username: args.username,
      password: args.password,
      session_id: uuid.v4(),
    });
  }

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

  async addDocuments(documents: Document[]): Promise<void> {
    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents
    );
  }

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

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    args: MyScaleLibArgs
  ): Promise<MyScaleStore> {
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    args: MyScaleLibArgs
  ): Promise<MyScaleStore> {
    const instance = new this(embeddings, args);

    await instance.initialize();
    return instance;
  }

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

  private buildSearchQuery(
    query: number[],
    k: number,
    filter?: MyScaleFilter
  ): string {
    const order = this.metric === "ip" ? "DESC" : "ASC";

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
