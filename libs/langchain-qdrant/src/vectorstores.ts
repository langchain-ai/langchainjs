import { QdrantClient } from "@qdrant/js-client-rest";
import type { Schemas as QdrantSchemas } from "@qdrant/js-client-rest";
import { v4 as uuid } from "uuid";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  type MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";

const CONTENT_KEY = "content";
const METADATA_KEY = "metadata";

/**
 * Interface for the arguments that can be passed to the
 * `QdrantVectorStore` constructor. It includes options for specifying a
 * `QdrantClient` instance, the URL and API key for a Qdrant database, and
 * the name and configuration for a collection.
 */
export interface QdrantLibArgs {
  client?: QdrantClient;
  url?: string;
  apiKey?: string;
  collectionName?: string;
  collectionConfig?: QdrantSchemas["CreateCollection"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customPayload?: Record<string, any>[];
  contentPayloadKey?: string;
  metadataPayloadKey?: string;
}

export type QdrantAddDocumentOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customPayload: Record<string, any>[];
};

export type QdrantFilter = QdrantSchemas["Filter"];

export type QdrantCondition = QdrantSchemas["FieldCondition"];

/**
 * Type for the response returned by a search operation in the Qdrant
 * database. It includes the score and payload (metadata and content) for
 * each point (document) in the search results.
 */
type QdrantSearchResponse = QdrantSchemas["ScoredPoint"] & {
  payload: {
    metadata: object;
    content: string;
  };
};

/**
 * Class that extends the `VectorStore` base class to interact with a
 * Qdrant database. It includes methods for adding documents and vectors
 * to the Qdrant database, searching for similar vectors, and ensuring the
 * existence of a collection in the database.
 */
export class QdrantVectorStore extends VectorStore {
  declare FilterType: QdrantFilter;

  get lc_secrets(): { [key: string]: string } {
    return {
      apiKey: "QDRANT_API_KEY",
      url: "QDRANT_URL",
    };
  }

  client: QdrantClient;

  collectionName: string;

  collectionConfig?: QdrantSchemas["CreateCollection"];

  contentPayloadKey: string;

  metadataPayloadKey: string;

  _vectorstoreType(): string {
    return "qdrant";
  }

  constructor(embeddings: EmbeddingsInterface, args: QdrantLibArgs) {
    super(embeddings, args);

    const url = args.url ?? getEnvironmentVariable("QDRANT_URL");
    const apiKey = args.apiKey ?? getEnvironmentVariable("QDRANT_API_KEY");

    if (!args.client && !url) {
      throw new Error("Qdrant client or url address must be set.");
    }

    this.client =
      args.client ||
      new QdrantClient({
        url,
        apiKey,
      });

    this.collectionName = args.collectionName ?? "documents";

    this.collectionConfig = args.collectionConfig;

    this.contentPayloadKey = args.contentPayloadKey ?? CONTENT_KEY;

    this.metadataPayloadKey = args.metadataPayloadKey ?? METADATA_KEY;
  }

  /**
   * Method to add documents to the Qdrant database. It generates vectors
   * from the documents using the `Embeddings` instance and then adds the
   * vectors to the database.
   * @param documents Array of `Document` instances to be added to the Qdrant database.
   * @param documentOptions Optional `QdrantAddDocumentOptions` which has a list of JSON objects for extra querying
   * @returns Promise that resolves when the documents have been added to the database.
   */
  async addDocuments(
    documents: Document[],
    documentOptions?: QdrantAddDocumentOptions
  ): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      documentOptions
    );
  }

  /**
   * Method to add vectors to the Qdrant database. Each vector is associated
   * with a document, which is stored as the payload for a point in the
   * database.
   * @param vectors Array of vectors to be added to the Qdrant database.
   * @param documents Array of `Document` instances associated with the vectors.
   * @param documentOptions Optional `QdrantAddDocumentOptions` which has a list of JSON objects for extra querying
   * @returns Promise that resolves when the vectors have been added to the database.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    documentOptions?: QdrantAddDocumentOptions
  ): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    await this.ensureCollection();

    const points = vectors.map((embedding, idx) => ({
      id: documents[idx].id ?? uuid(),
      vector: embedding,
      payload: {
        [this.contentPayloadKey]: documents[idx].pageContent,
        [this.metadataPayloadKey]: documents[idx].metadata,
        customPayload: documentOptions?.customPayload[idx],
      },
    }));

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const error = new Error(
        `${e?.status ?? "Undefined error code"} ${e?.message}: ${
          e?.data?.status?.error
        }`
      );
      throw error;
    }
  }

  /**
   * Method to search for vectors in the Qdrant database that are similar to
   * a given query vector. The search results include the score and payload
   * (metadata and content) for each similar vector.
   * @param query Query vector to search for similar vectors in the Qdrant database.
   * @param k Optional number of similar vectors to return. If not specified, all similar vectors are returned.
   * @param filter Optional filter to apply to the search results.
   * @returns Promise that resolves with an array of tuples, where each tuple includes a `Document` instance and a score for a similar vector.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k?: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    if (!query) {
      return [];
    }

    await this.ensureCollection();

    const results = await this.client.search(this.collectionName, {
      vector: query,
      limit: k,
      filter,
      with_payload: [this.metadataPayloadKey, this.contentPayloadKey],
      with_vector: false,
    });

    const result: [Document, number][] = (
      results as QdrantSearchResponse[]
    ).map((res) => [
      new Document({
        id: res.id as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: res.payload[this.metadataPayloadKey] as Record<string, any>,
        pageContent: res.payload[this.contentPayloadKey] as string,
      }),
      res.score,
    ]);

    return result;
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents.
   *
   * @param {string} query - Text to look up documents similar to.
   * @param {number} options.k - Number of documents to return.
   * @param {number} options.fetchK - Number of documents to fetch before passing to the MMR algorithm. Defaults to 20.
   * @param {number} options.lambda - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {this["FilterType"]} options.filter - Optional filter to apply to the search results.
   *
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    if (!query) {
      return [];
    }

    const queryEmbedding = await this.embeddings.embedQuery(query);

    await this.ensureCollection();

    const results = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit: options?.fetchK ?? 20,
      filter: options?.filter,
      with_payload: [this.metadataPayloadKey, this.contentPayloadKey],
      with_vector: true,
    });

    const embeddingList = results.map((res) => res.vector) as number[][];

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      options?.lambda,
      options.k
    );

    const topMmrMatches = mmrIndexes.map((idx) => results[idx]);

    const result = (topMmrMatches as QdrantSearchResponse[]).map(
      (res) =>
        new Document({
          id: res.id as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: res.payload[this.metadataPayloadKey] as Record<string, any>,
          pageContent: res.payload[this.contentPayloadKey] as string,
        })
    );

    return result;
  }

  /**
   * Method to ensure the existence of a collection in the Qdrant database.
   * If the collection does not exist, it is created.
   * @returns Promise that resolves when the existence of the collection has been ensured.
   */
  async ensureCollection() {
    const response = await this.client.getCollections();

    const collectionNames = response.collections.map(
      (collection) => collection.name
    );

    if (!collectionNames.includes(this.collectionName)) {
      const collectionConfig = this.collectionConfig ?? {
        vectors: {
          size: (await this.embeddings.embedQuery("test")).length,
          distance: "Cosine",
        },
      };
      await this.client.createCollection(this.collectionName, collectionConfig);
    }
  }

  /**
   * Static method to create a `QdrantVectorStore` instance from texts. Each
   * text is associated with metadata and converted to a `Document`
   * instance, which is then added to the Qdrant database.
   * @param texts Array of texts to be converted to `Document` instances and added to the Qdrant database.
   * @param metadatas Array or single object of metadata to be associated with the texts.
   * @param embeddings `Embeddings` instance used to generate vectors from the texts.
   * @param dbConfig `QdrantLibArgs` instance specifying the configuration for the Qdrant database.
   * @returns Promise that resolves with a new `QdrantVectorStore` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return QdrantVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a `QdrantVectorStore` instance from `Document`
   * instances. The documents are added to the Qdrant database.
   * @param docs Array of `Document` instances to be added to the Qdrant database.
   * @param embeddings `Embeddings` instance used to generate vectors from the documents.
   * @param dbConfig `QdrantLibArgs` instance specifying the configuration for the Qdrant database.
   * @returns Promise that resolves with a new `QdrantVectorStore` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    if (dbConfig.customPayload) {
      const documentOptions = {
        customPayload: dbConfig?.customPayload,
      };
      await instance.addDocuments(docs, documentOptions);
    } else {
      await instance.addDocuments(docs);
    }
    return instance;
  }

  /**
   * Static method to create a `QdrantVectorStore` instance from an existing
   * collection in the Qdrant database.
   * @param embeddings `Embeddings` instance used to generate vectors from the documents in the collection.
   * @param dbConfig `QdrantLibArgs` instance specifying the configuration for the Qdrant database.
   * @returns Promise that resolves with a new `QdrantVectorStore` instance.
   */
  static async fromExistingCollection(
    embeddings: EmbeddingsInterface,
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.ensureCollection();
    return instance;
  }
}
