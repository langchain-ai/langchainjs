import { v4 } from "uuid";
import { WeaviateObject, type WeaviateClient } from "weaviate-ts-client";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export interface WeaviateLibArgs {
  client: WeaviateClient;
  indexName: string;
  textKey: string;
  attributes?: string[];
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
    this.textKey = args.textKey;
    this.queryAttrs = [this.textKey];

    if (args.attributes) {
      this.queryAttrs = this.queryAttrs.concat(args.attributes);
    }
  }

  addVectors(_vectors: number[][], _documents: Document[]): Promise<void> {
    throw new Error("Not Implemented");
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const batch: WeaviateObject[] = documents.map((document) => ({
      class: this.indexName,
      id: v4(),
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

  similaritySearchVectorWithScore(
    _query: number[],
    _k: number,
    _filter?: object
  ): Promise<[Document, number][]> {
    throw new Error("Not Implemented");
  }

  async similaritySearch(
    query: string,
    k: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: Record<string, any> | undefined
  ): Promise<Document[]> {
    const content: {
      concepts: string[];
      certainty?: number;
    } = {
      concepts: [query],
    };

    if (filter?.searchDistance) {
      content.certainty = filter.searchDistance;
    }

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.indexName)
        .withFields(this.queryAttrs.join(" "))
        .withNearText({ concepts: [query] })
        .withLimit(k)
        .do();

      const documents = [];
      for (const data of result.data.Get[this.indexName]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const record: Record<string, any> = data;
        const text = record[this.textKey];
        delete record[this.textKey];

        documents.push(
          new Document({
            pageContent: text,
            metadata: record,
          })
        );
      }
      return documents;
    } catch (e) {
      throw Error(`'Error in similaritySearch' ${e}`);
    }
  }

  similaritySearchWithScore(
    _query: string,
    _k?: number,
    _filter?: object | undefined
  ): Promise<[object, number][]> {
    throw Error("Not Implemented");
  }

  static fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: Embeddings,
    args: WeaviateLibArgs
  ): Promise<VectorStore> {
    const docs = [];
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
  ): Promise<VectorStore> {
    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }
}
