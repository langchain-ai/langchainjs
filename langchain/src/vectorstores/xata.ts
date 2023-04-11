import type { SchemaPluginResult, ColumnsByValue } from "@xata.io/client";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

type InferColumns<T> = T extends SchemaPluginResult<infer U> ? U : never;

type XataVectorStoreArgs<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Xata extends SchemaPluginResult<any>,
  TableName extends keyof Xata,
  Schema extends InferColumns<Xata>
> = {
  xataDB: Xata;
  tableName: TableName;
  vectorColumnName: ColumnsByValue<Schema[TableName], number[]>;
  contentColumnName: ColumnsByValue<Schema[TableName], string>;
};

export class XataVectorStore<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Xata extends SchemaPluginResult<any>,
  TableName extends keyof Xata,
  Schema extends InferColumns<Xata>
> extends VectorStore {
  client: Xata[TableName];

  vectorColumnName: string;

  contentColumnName: string;

  constructor(
    embeddings: Embeddings,
    args: XataVectorStoreArgs<Xata, TableName, Schema>
  ) {
    super(embeddings, args);
    this.client = args.xataDB[args.tableName];

    this.vectorColumnName = args.vectorColumnName;
    this.contentColumnName = args.contentColumnName;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const rows = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    for (const row of rows) {
      try {
        await this.client.create({
          [this.contentColumnName]: row.content,
          [this.vectorColumnName]: row.embedding,
        });
      } catch (err) {
        throw new Error(`Error inserting: ${err}`);
      }
    }
  }

  async similaritySearchVectorWithScore(
    embedingQuery: number[],
    k: number
  ): Promise<[Document, number][]> {
    let records;
    try {
      records = await this.client.vectorSearch(
        this.vectorColumnName,
        embedingQuery,
        {
          size: k,
        }
      );
    } catch (err) {
      throw new Error(`Error searching for documents: ${err}`);
    }

    const result: [Document, number][] = records.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (record: Record<string, any>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = record;

        const content = rest[this.contentColumnName];

        // everything from metadata, except the field name defined in this.contentColumnName
        const metadata = Object.keys(record).reduce((acc, key) => {
          if (key !== this.contentColumnName) {
            acc[key] = record[key];
          }
          return acc;
        }, {} as typeof record);

        return [
          new Document({
            metadata,
            pageContent: content,
          }),
          record?.xata?.score,
        ];
      }
    );

    return result;
  }

  static async fromTexts<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Xata extends SchemaPluginResult<any>,
    TableName extends keyof Xata,
    Schema extends InferColumns<Xata>
  >(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: XataVectorStoreArgs<Xata, TableName, Schema>
  ): Promise<XataVectorStore<Xata, TableName, Schema>> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return XataVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Xata extends SchemaPluginResult<any>,
    TableName extends keyof Xata,
    Schema extends InferColumns<Xata>
  >(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: XataVectorStoreArgs<Xata, TableName, Schema>
  ): Promise<XataVectorStore<Xata, TableName, Schema>> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Xata extends SchemaPluginResult<any>,
    TableName extends keyof Xata,
    Schema extends InferColumns<Xata>
  >(
    embeddings: Embeddings,
    dbConfig: XataVectorStoreArgs<Xata, TableName, Schema>
  ): Promise<XataVectorStore<Xata, TableName, Schema>> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
