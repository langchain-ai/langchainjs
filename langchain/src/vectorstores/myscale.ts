import { v4 as uuid } from "uuid";
import { ClickHouseClient, createClient } from "@clickhouse/client";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

export interface MyscaleLibArgs {
  host: string;
  username: string;
  password: string;
  indexType?: string;
  indexParam?: { [key: string]: string };
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

export interface MyscaleFilter {
  whereStr: string;
}

export class MyscaleStore extends VectorStore {
  client: ClickHouseClient;

  indexType: string;

  indexParam: { [key: string]: string };

  columnMap: ColumnMap;

  database: string;

  table: string;

  metric: metric;

  isInitialized = false;

  constructor(embeddings: Embeddings, args: MyscaleLibArgs) {
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
      host: args.host,
      username: args.username,
      password: args.password,
      session_id: uuid(),
    });
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    if (!this.isInitialized) {
      await this.initialize();
      this.isInitialized = true;
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
    filter?: MyscaleFilter
  ): Promise<[Document, number][]> {
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

  async similaritySearch(
    query: string,
    k: number,
    filter?: MyscaleFilter
  ): Promise<Document[]> {
    return super.similaritySearch(query, k, filter);
  }

  async similaritySearchWithScore(
    query: string,
    k: number,
    filter?: MyscaleFilter
  ): Promise<[Document, number][]> {
    return super.similaritySearchWithScore(query, k, filter);
  }

  static async fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: Embeddings,
    args: MyscaleLibArgs
  ): Promise<MyscaleStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return MyscaleStore.fromDocuments(docs, embeddings, args);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    args: MyscaleLibArgs
  ): Promise<MyscaleStore> {
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    args: MyscaleLibArgs
  ): Promise<MyscaleStore> {
    const instance = new this(embeddings, args);

    await instance.initialize();
    return instance;
  }

  async initialize(): Promise<void> {
    const dim = (await this.embeddings.embedQuery("try this out")).length;

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
  }

  buildInsertQuery(vectors: number[][], documents: Document[]): string {
    const columnsStr = Object.values(this.columnMap).join(", ");

    const data: string[] = [];
    for (let i = 0; i < vectors.length; i += 1) {
      const vector = vectors[i];
      const document = documents[i];
      const item = [
        `'${uuid()}'`,
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

  escapeString(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  buildSearchQuery(query: number[], k: number, filter?: MyscaleFilter): string {
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
