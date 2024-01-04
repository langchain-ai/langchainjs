import * as uuid from "uuid";

import { AstraDB } from "@datastax/astra-db-ts";
import { Collection } from "@datastax/astra-db-ts/dist/collections";
import { CreateCollectionOptions } from "@datastax/astra-db-ts/dist/collections/options.js";

import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";

export type CollectionFilter = Record<string, unknown>;

export interface AstraLibArgs {
  token: string;
  endpoint: string;
  collection: string;
  namespace?: string;
  idKey?: string;
  contentKey?: string;
  collectionOptions?: CreateCollectionOptions;
  batchSize?: number;
}

export class AstraDBVectorStore extends VectorStore {
  declare FilterType: CollectionFilter;

  private astraDBClient: AstraDB;

  private collectionName: string;

  private collection: Collection | undefined;

  private collectionOptions: CreateCollectionOptions | undefined;

  private readonly idKey: string;

  private readonly contentKey: string; // if undefined the entirety of the content aside from the id and embedding will be stored as content

  _vectorstoreType(): string {
    return "astradb";
  }

  constructor(embeddings: EmbeddingsInterface, args: AstraLibArgs) {
    super(embeddings, args);

    this.astraDBClient = new AstraDB(args.token, args.endpoint);
    this.collectionName = args.collection;
    this.collectionOptions = args.collectionOptions;
    this.idKey = args.idKey ?? "_id";
    this.contentKey = args.contentKey ?? "text";
  }

  /**
   * Create a new collection in your Astra DB vector database and then connects to it.
   * If the collection already exists, it will connect to it as well.
   *
   * @returns Promise that resolves if connected to the collection.
   */
  async initialize(): Promise<void> {
    try {
      await this.astraDBClient.createCollection(
        this.collectionName,
        this.collectionOptions
      );
    } catch (error) {
      console.debug(
        `Collection already exists, connecting to ${this.collectionName}`
      );
    }
    this.collection = await this.astraDBClient.collection(this.collectionName);
    console.debug("Connected to Astra DB collection");
  }

  /**
   * Method to save vectors to AstraDB.
   *
   * @param vectors Vectors to save.
   * @param documents The documents associated with the vectors.
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: string[]
  ) {
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

  /**
   * Method that adds documents to AstraDB.
   *
   * @param documents Array of documents to add to AstraDB.
   * @param options Optional ids for the documents.
   * @returns Promise that resolves the documents have been added.
   */
  async addDocuments(documents: Document[], options?: string[]) {
    if (!this.collection) {
      throw new Error("Must connect to a collection before adding vectors");
    }

    return this.addVectors(
      await this.embeddings.embedDocuments(documents.map((d) => d.pageContent)),
      documents,
      options
    );
  }

  /**
   * Method that performs a similarity search in AstraDB and returns and similarity scores.
   *
   * @param query Query vector for the similarity search.
   * @param k Number of top results to return.
   * @param filter Optional filter to apply to the search.
   * @returns Promise that resolves with an array of documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: CollectionFilter
  ): Promise<[Document, number][]> {
    if (!this.collection) {
      throw new Error("Must connect to a collection before adding vectors");
    }

    const cursor = await this.collection.find(filter ?? {}, {
      sort: { $vector: query },
      limit: k,
      includeSimilarity: true,
    });

    const results: [Document, number][] = [];

    await cursor.forEach(async (row: Record<string, unknown>) => {
      const {
        $similarity: similarity,
        [this.contentKey]: content,
        ...metadata
      } = row;

      const doc = new Document({
        pageContent: content as string,
        metadata,
      });

      results.push([doc, similarity as number]);
    });

    return results;
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents.
   *
   * @param {string} query - Text to look up documents similar to.
   * @param {number} options.k - Number of documents to return.
   * @param {number} options.fetchK - Number of documents to fetch before passing to the MMR algorithm.
   * @param {number} options.lambda - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {CollectionFilter} options.filter - Optional filter
   *
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    if (!this.collection) {
      throw new Error("Must connect to a collection before adding vectors");
    }

    const queryEmbedding = await this.embeddings.embedQuery(query);

    const cursor = await this.collection.find(options.filter ?? {}, {
      sort: { $vector: queryEmbedding },
      limit: options.k,
      includeSimilarity: true,
    });

    const results = (await cursor.toArray()) ?? [];
    const embeddingList: number[][] = results.map(
      (row) => row.$vector as number[]
    );

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      options.lambda,
      options.k
    );

    const topMmrMatches = mmrIndexes.map((idx) => results[idx]);

    const docs: Document[] = [];
    topMmrMatches.forEach((match) => {
      const { [this.contentKey]: content, ...metadata } = match;

      const doc: Document = {
        pageContent: content as string,
        metadata,
      };

      docs.push(doc);
    });

    return docs;
  }

  /**
   * Static method to create an instance of AstraDBVectorStore from texts.
   *
   * @param texts The texts to use.
   * @param metadatas The metadata associated with the texts.
   * @param embeddings The embeddings to use.
   * @param dbConfig The arguments for the AstraDBVectorStore.
   * @returns Promise that resolves with a new instance of AstraDBVectorStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: AstraLibArgs
  ): Promise<AstraDBVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const doc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(doc);
    }
    return AstraDBVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create an instance of AstraDBVectorStore from documents.
   *
   * @param docs The Documents to use.
   * @param embeddings The embeddings to use.
   * @param dbConfig The arguments for the AstraDBVectorStore.
   * @returns Promise that resolves with a new instance of AstraDBVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: AstraLibArgs
  ): Promise<AstraDBVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.initialize();

    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method to create an instance of AstraDBVectorStore from an existing index.
   *
   * @param embeddings The embeddings to use.
   * @param dbConfig The arguments for the AstraDBVectorStore.
   * @returns Promise that resolves with a new instance of AstraDBVectorStore.
   */
  static async fromExistingIndex(
    embeddings: EmbeddingsInterface,
    dbConfig: AstraLibArgs
  ): Promise<AstraDBVectorStore> {
    const instance = new this(embeddings, dbConfig);

    await instance.initialize();
    return instance;
  }
}
