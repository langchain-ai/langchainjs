import {
  DocumentCollection,
  IDocument,
  NotFoundError,
  ZepClient,
} from "@getzep/zep-js";

import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { Callbacks } from "@langchain/core/callbacks/manager";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { FakeEmbeddings } from "../utils/testing.js";

/**
 * Interface for the arguments required to initialize a ZepVectorStore
 * instance.
 */
export interface IZepArgs {
  collection: DocumentCollection;
}

/**
 * Interface for the configuration options for a ZepVectorStore instance.
 */
export interface IZepConfig {
  apiUrl: string;
  apiKey?: string;
  collectionName: string;
  description?: string;
  metadata?: Record<string, never>;
  embeddingDimensions?: number;
  isAutoEmbedded?: boolean;
}

/**
 * Interface for the parameters required to delete documents from a
 * ZepVectorStore instance.
 */
export interface IZepDeleteParams {
  uuids: string[];
}

/**
 * ZepVectorStore is a VectorStore implementation that uses the Zep long-term memory store as a backend.
 *
 * If the collection does not exist, it will be created automatically.
 *
 * Requires `zep-js` to be installed:
 * ```bash
 * npm install @getzep/zep-js
 * ```
 *
 * @property {ZepClient} client - The ZepClient instance used to interact with Zep's API.
 * @property {Promise<void>} initPromise - A promise that resolves when the collection is initialized.
 * @property {DocumentCollection} collection - The Zep document collection.
 */
export class ZepVectorStore extends VectorStore {
  public client: ZepClient;

  public collection: DocumentCollection;

  private initPromise: Promise<void>;

  private autoEmbed = false;

  constructor(embeddings: Embeddings, args: IZepConfig) {
    super(embeddings, args);

    this.embeddings = embeddings;

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (this.embeddings instanceof FakeEmbeddings) {
      this.autoEmbed = true;
    }

    this.initPromise = this.initCollection(args).catch((err) => {
      console.error("Error initializing collection:", err);
      throw err;
    });
  }

  /**
   * Initializes the document collection. If the collection does not exist, it creates a new one.
   *
   * @param {IZepConfig} args - The configuration object for the Zep API.
   */
  private async initCollection(args: IZepConfig) {
    this.client = await ZepClient.init(args.apiUrl, args.apiKey);
    try {
      this.collection = await this.client.document.getCollection(
        args.collectionName
      );

      // If the Embedding passed in is fake, but the collection is not auto embedded, throw an error
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (!this.collection.is_auto_embedded && this.autoEmbed) {
        throw new Error(`You can't pass in FakeEmbeddings when collection ${args.collectionName} 
 is not set to auto-embed.`);
      }
    } catch (err) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (err instanceof Error) {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (err instanceof NotFoundError || err.name === "NotFoundError") {
          await this.createCollection(args);
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Creates a new document collection.
   *
   * @param {IZepConfig} args - The configuration object for the Zep API.
   */
  private async createCollection(args: IZepConfig) {
    if (!args.embeddingDimensions) {
      throw new Error(`Collection ${args.collectionName} not found. 
 You can create a new Collection by providing embeddingDimensions.`);
    }

    this.collection = await this.client.document.addCollection({
      name: args.collectionName,
      description: args.description,
      metadata: args.metadata,
      embeddingDimensions: args.embeddingDimensions,
      isAutoEmbedded: this.autoEmbed,
    });

    console.info("Created new collection:", args.collectionName);
  }

  /**
   * Adds vectors and corresponding documents to the collection.
   *
   * @param {number[][]} vectors - The vectors to add.
   * @param {Document[]} documents - The corresponding documents to add.
   * @returns {Promise<string[]>} - A promise that resolves with the UUIDs of the added documents.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[]
  ): Promise<string[]> {
    if (!this.autoEmbed && vectors.length === 0) {
      throw new Error(`Vectors must be provided if autoEmbed is false`);
    }
    if (!this.autoEmbed && vectors.length !== documents.length) {
      throw new Error(`Vectors and documents must have the same length`);
    }

    const docs: Array<IDocument> = [];
    for (let i = 0; i < documents.length; i += 1) {
      const doc: IDocument = {
        content: documents[i].pageContent,
        metadata: documents[i].metadata,
        embedding: vectors.length > 0 ? vectors[i] : undefined,
      };
      docs.push(doc);
    }
    // Wait for collection to be initialized
    await this.initPromise;
    return await this.collection.addDocuments(docs);
  }

  /**
   * Adds documents to the collection. The documents are first embedded into vectors
   * using the provided embedding model.
   *
   * @param {Document[]} documents - The documents to add.
   * @returns {Promise<string[]>} - A promise that resolves with the UUIDs of the added documents.
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    let vectors: number[][] = [];
    if (!this.autoEmbed) {
      vectors = await this.embeddings.embedDocuments(texts);
    }
    return this.addVectors(vectors, documents);
  }

  _vectorstoreType(): string {
    return "zep";
  }

  /**
   * Deletes documents from the collection.
   *
   * @param {IZepDeleteParams} params - The list of Zep document UUIDs to delete.
   * @returns {Promise<void>}
   */
  async delete(params: IZepDeleteParams): Promise<void> {
    // Wait for collection to be initialized
    await this.initPromise;
    for (const uuid of params.uuids) {
      await this.collection.deleteDocument(uuid);
    }
  }

  /**
   * Performs a similarity search in the collection and returns the results with their scores.
   *
   * @param {number[]} query - The query vector.
   * @param {number} k - The number of results to return.
   * @param {Record<string, unknown>} filter - The filter to apply to the search. Zep only supports Record<string, unknown> as filter.
   * @returns {Promise<[Document, number][]>} - A promise that resolves with the search results and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: Record<string, unknown> | undefined
  ): Promise<[Document, number][]> {
    await this.initPromise;
    const results = await this.collection.search(
      {
        embedding: new Float32Array(query),
        metadata: assignMetadata(filter),
      },
      k
    );
    return zepDocsToDocumentsAndScore(results);
  }

  async _similaritySearchWithScore(
    query: string,
    k: number,
    filter?: Record<string, unknown> | undefined
  ): Promise<[Document, number][]> {
    await this.initPromise;
    const results = await this.collection.search(
      {
        text: query,
        metadata: assignMetadata(filter),
      },
      k
    );
    return zepDocsToDocumentsAndScore(results);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: Record<string, unknown> | undefined = undefined,
    _callbacks = undefined // implement passing to embedQuery later
  ): Promise<[Document, number][]> {
    if (this.autoEmbed) {
      return this._similaritySearchWithScore(query, k, filter);
    } else {
      return this.similaritySearchVectorWithScore(
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    }
  }

  /**
   * Performs a similarity search on the Zep collection.
   *
   * @param {string} query - The query string to search for.
   * @param {number} [k=4] - The number of results to return. Defaults to 4.
   * @param {this["FilterType"] | undefined} [filter=undefined] - An optional set of JSONPath filters to apply to the search.
   * @param {Callbacks | undefined} [_callbacks=undefined] - Optional callbacks. Currently not implemented.
   * @returns {Promise<Document[]>} - A promise that resolves to an array of Documents that are similar to the query.
   *
   * @async
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    _callbacks: Callbacks | undefined = undefined // implement passing to embedQuery later
  ): Promise<Document[]> {
    await this.initPromise;

    let results: [Document, number][];
    if (this.autoEmbed) {
      const zepResults = await this.collection.search(
        { text: query, metadata: assignMetadata(filter) },
        k
      );
      results = zepDocsToDocumentsAndScore(zepResults);
    } else {
      results = await this.similaritySearchVectorWithScore(
        await this.embeddings.embedQuery(query),
        k,
        assignMetadata(filter)
      );
    }

    return results.map((result) => result[0]);
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents.
   *
   * @param {string} query - Text to look up documents similar to.
   * @param options
   * @param {number} options.k - Number of documents to return.
   * @param {number} options.fetchK=20- Number of documents to fetch before passing to the MMR algorithm.
   * @param {number} options.lambda=0.5 - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {Record<string, any>} options.filter - Optional Zep JSONPath query to pre-filter on document metadata field
   *
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const { k, fetchK = 20, lambda = 0.5, filter } = options;

    let queryEmbedding: number[];
    let zepResults: IDocument[];
    if (!this.autoEmbed) {
      queryEmbedding = await this.embeddings.embedQuery(query);
      zepResults = await this.collection.search(
        {
          embedding: new Float32Array(queryEmbedding),
          metadata: assignMetadata(filter),
        },
        fetchK
      );
    } else {
      let queryEmbeddingArray: Float32Array;
      [zepResults, queryEmbeddingArray] =
        await this.collection.searchReturnQueryVector(
          { text: query, metadata: assignMetadata(filter) },
          fetchK
        );
      queryEmbedding = Array.from(queryEmbeddingArray);
    }

    const results = zepDocsToDocumentsAndScore(zepResults);

    const embeddingList = zepResults.map((doc) =>
      Array.from(doc.embedding ? doc.embedding : [])
    );

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      lambda,
      k
    );

    return mmrIndexes.filter((idx) => idx !== -1).map((idx) => results[idx][0]);
  }

  /**
   * Creates a new ZepVectorStore instance from an array of texts. Each text is converted into a Document and added to the collection.
   *
   * @param {string[]} texts - The texts to convert into Documents.
   * @param {object[] | object} metadatas - The metadata to associate with each Document. If an array is provided, each element is associated with the corresponding Document. If an object is provided, it is associated with all Documents.
   * @param {Embeddings} embeddings - The embeddings to use for vectorizing the texts.
   * @param {IZepConfig} zepConfig - The configuration object for the Zep API.
   * @returns {Promise<ZepVectorStore>} - A promise that resolves with the new ZepVectorStore instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    zepConfig: IZepConfig
  ): Promise<ZepVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return ZepVectorStore.fromDocuments(docs, embeddings, zepConfig);
  }

  /**
   * Creates a new ZepVectorStore instance from an array of Documents. Each Document is added to a Zep collection.
   *
   * @param {Document[]} docs - The Documents to add.
   * @param {Embeddings} embeddings - The embeddings to use for vectorizing the Document contents.
   * @param {IZepConfig} zepConfig - The configuration object for the Zep API.
   * @returns {Promise<ZepVectorStore>} - A promise that resolves with the new ZepVectorStore instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    zepConfig: IZepConfig
  ): Promise<ZepVectorStore> {
    const instance = new this(embeddings, zepConfig);
    // Wait for collection to be initialized
    await instance.initPromise;
    await instance.addDocuments(docs);
    return instance;
  }
}

function zepDocsToDocumentsAndScore(
  results: IDocument[]
): [Document, number][] {
  return results.map((d) => [
    new Document({
      pageContent: d.content,
      metadata: d.metadata,
    }),
    d.score ? d.score : 0,
  ]);
}

function assignMetadata(
  value: string | Record<string, unknown> | object | undefined
): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  if (value !== undefined) {
    console.warn("Metadata filters must be an object, Record, or undefined.");
  }
  return undefined;
}
