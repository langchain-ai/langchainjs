import * as uuid from "uuid";

import { AstraDB } from "@datastax/astra-db-ts";
import { Collection } from "@datastax/astra-db-ts/dist/collections";
import { CreateCollectionOptions } from "@datastax/astra-db-ts/dist/collections/options.js";

import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";

export type CollectionFilter = Record<string, unknown>;

export interface AstraLibArgs {
  token: string;
  endpoint: string;
  namespace?: string;
  idKey?: string;
  contentKey?: string;
}

export class AstraDBVectorStore extends VectorStore {
  declare FilterType: CollectionFilter;

  private astraDBClient: AstraDB;

  private collection: Collection | undefined;

  private readonly idKey: string;

  private readonly contentKey: string; // if undefined the entirety of the content aside from the id and embedding will be stored as content

  _vectorstoreType(): string {
    return "astradb";
  }

  constructor(embeddings: Embeddings, args: AstraLibArgs) {
    super(embeddings, args);

    this.astraDBClient = new AstraDB(
      args.token, args.endpoint
    );

    this.idKey = args.idKey ?? "_id";
    this.contentKey = args.contentKey ?? "content";
  }

  /**
   * Create a new collection in your Astra DB vector database.
   * You must still use connect() to connect to the collection.
   *
   * @param collection your new colletion's name
   * @param options: CreateCollectionOptions used to set the number of vector dimensions and similarity metric
   * @returns Promise that resolves if the creation did not throw an error.
   */
  async create(
    collection: string,
    options: CreateCollectionOptions,
  ): Promise<void> {
    await this.astraDBClient.createCollection(collection, options);
    console.debug("Created Astra DB collection");
  }

  /**
   * Connect to an existing collection in your Astra DB vector database.
   * You must call this before adding, deleting, or querying.
   *
   * @param collection your existing colletion's name
   * @returns Promise that resolves if the connection did not throw an error.
   */
  async connect(collection: string): Promise<void> {
    this.collection = await this.astraDBClient.collection(collection);
    console.debug("Connected to Astra DB collection");
  }

  async addDocuments(documents: Document[]) {
    if (!this.collection) {
      throw new Error("Must connect to a collection before adding vectors");
    }

    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[], options?: string[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Must connect to a collection before adding vectors");
    }

    const docs = vectors.map((embedding, idx) => ({
      [this.idKey]: options?.[idx] ?? uuid.v4(),
      [this.contentKey]: documents[idx].pageContent,
      $vector: embedding,
      ...documents[idx].metadata,
    }));

    await this.collection.insertMany(docs);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: CollectionFilter
  ): Promise<[Document, number][]> {
    if (!this.collection) {
      throw new Error("Must connect to a collection before adding vectors");
    }
    
    const cursor = await this.collection.find(
      filter ?? {},
      { 
        sort: { $vector: query },
        limit: k,
        includeSimilarity: true,
      }
    );

    const results: [Document, number][] = [];

    await cursor.forEach(async (row: Record<string, unknown>) => {
      
      const { $similarity: similarity, [this.idKey]: id, [this.contentKey]: content, ...metadata } = row;

      const doc: Document = {
        pageContent: content as string,
        metadata,
      };

      results.push([doc, similarity as number]);
    });

    return results;
  }


}