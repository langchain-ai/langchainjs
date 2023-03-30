import { SchemaPluginResult, ColumnsByValue } from "@xata.io/client";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

type InferColumns<T> = T extends SchemaPluginResult<infer U> ? U : never;

type XataVectorStoreArgs<
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
  Xata extends SchemaPluginResult<any>,
  TableName extends keyof Xata,
  Schema extends InferColumns<Xata>
> extends VectorStore {
  client: Xata[TableName];

  vectorColumnName: string;

  contentColumnName: string;

  constructor(
    embeddings: Embeddings,
    args: {
      xataDB: Xata;
      tableName: TableName;
      vectorColumnName: ColumnsByValue<Schema[TableName], number[]>;
      contentColumnName: ColumnsByValue<Schema[TableName], string>;
    }
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
      } catch (err: any) {
        throw new Error(`Error inserting: ${err.message}`);
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
    } catch (err: any) {
      throw new Error(`Error searching for documents: ${err}`);
    }

    const result: [Document, number][] = records.map(
      (record: Record<string, any>) => {
        const { id, ...rest } = record;

        const content = rest[this.contentColumnName];

        // everything from metadata, except the field name defined in this.contentColumnName
        const metadata = Object.keys(record).reduce((acc, key) => {
          if (key !== this.contentColumnName) {
            acc[key] = record[key];
          }
          return acc;
        }, {} as Record<string, any>);

        return [
          new Document({
            metadata,
            pageContent: content,
          }),
          record.xata.score,
        ];
      }
    );

    return result;
  }

  static async fromTexts<
    Xata extends SchemaPluginResult<any>,
    TableName extends keyof Xata,
    Schema extends InferColumns<Xata>
  >(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: XataVectorStoreArgs<Xata, TableName, Schema>
  ): Promise<XataVectorStore<Xata, TableName, Schema>> {
    const docs = [];
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
    Xata extends SchemaPluginResult<any>,
    TableName extends keyof Xata,
    Schema extends InferColumns<Xata>
  >(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: XataVectorStoreArgs<Xata, TableName, Schema>
  ): Promise<XataVectorStore<Xata, TableName, Schema>> {
    const instance = new this(embeddings, dbConfig as any) as any;
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex<
    Xata extends SchemaPluginResult<any>,
    TableName extends keyof Xata,
    Schema extends InferColumns<Xata>
  >(
    embeddings: Embeddings,
    dbConfig: XataVectorStoreArgs<Xata, TableName, Schema>
  ): Promise<XataVectorStore<Xata, TableName, Schema>> {
    const instance = new this(embeddings, dbConfig as any) as any;
    return instance;
  }
}
