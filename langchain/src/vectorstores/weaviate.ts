import { v4 } from "uuid";
import type {
  WeaviateObject,
  WeaviateClient,
  WhereFilter,
} from "weaviate-ts-client";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export interface WeaviateLibArgs {
  client: WeaviateClient;
  /**
   * The name of the class in Weaviate. Must start with a capital letter.
   */
  indexName: string;
  textKey?: string;
  metadataKeys?: string[];
}

interface ResultRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface WeaviateFilter {
  distance?: number;
  where: WhereFilter;
}

export class WeaviateStore extends VectorStore {
  private client: WeaviateClient;

  private indexName: string;

  private textKey: string;

  private queryAttrs: string[];

  constructor(public embeddings: Embeddings, args: WeaviateLibArgs) {
    super(embeddings, args);

    this.client = args.client;
    this.indexName = args.indexName;
    this.textKey = args.textKey || "text";
    this.queryAttrs = [this.textKey];

    if (args.metadataKeys) {
      this.queryAttrs = this.queryAttrs.concat(args.metadataKeys);
    }
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const batch: WeaviateObject[] = documents.map((document, index) => ({
      class: this.indexName,
      id: v4(),
      vector: vectors[index],
      properties: {
        [this.textKey]: document.pageContent,
        ...document.metadata,
      },
    }));

    try {
      await this.client.batch
        .objectsBatcher()
        .withObjects(...batch)
        .do();
    } catch (e) {
      throw Error(`'Error in addDocuments' ${e}`);
    }
  }

  async addDocuments(documents: Document[]): Promise<void> {
    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents
    );
  }

  async similaritySearch(
    query: string,
    k: number,
    filter?: WeaviateFilter
  ): Promise<Document[]> {
    return super.similaritySearch(query, k, filter);
  }

  async similaritySearchWithScore(
    query: string,
    k: number,
    filter?: WeaviateFilter
  ): Promise<[Document, number][]> {
    return super.similaritySearchWithScore(query, k, filter);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: WeaviateFilter
  ): Promise<[Document, number][]> {
    try {
      let builder = await this.client.graphql
        .get()
        .withClassName(this.indexName)
        .withFields(`${this.queryAttrs.join(" ")} _additional { distance }`)
        .withNearVector({
          vector: query,
          distance: filter?.distance,
        })
        .withLimit(k);

      if (filter?.where) {
        builder = builder.withWhere(filter.where);
      }

      const result = await builder.do();

      const documents: [Document, number][] = [];
      for (const data of result.data.Get[this.indexName]) {
        const { [this.textKey]: text, _additional, ...rest }: ResultRow = data;

        documents.push([
          new Document({
            pageContent: text,
            metadata: rest,
          }),
          _additional.distance,
        ]);
      }
      return documents;
    } catch (e) {
      throw Error(`'Error in similaritySearch' ${e}`);
    }
  }

  static fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: Embeddings,
    args: WeaviateLibArgs
  ): Promise<WeaviateStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return WeaviateStore.fromDocuments(docs, embeddings, args);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    args: WeaviateLibArgs
  ): Promise<WeaviateStore> {
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    args: WeaviateLibArgs
  ): Promise<WeaviateStore> {
    return new this(embeddings, args);
  }
}
