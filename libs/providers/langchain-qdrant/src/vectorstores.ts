import { QdrantClient } from "@qdrant/js-client-rest";
import type { Schemas as QdrantSchemas } from "@qdrant/js-client-rest";
import { v4 as uuid } from "@langchain/core/utils/uuid";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  type MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import type { Callbacks } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

const CONTENT_KEY = "content";
const METADATA_KEY = "metadata";
const DEFAULT_SPARSE_VECTOR_NAME = "langchain-sparse";
const DEFAULT_SPARSE_DOCUMENT_OPTIONS: QdrantSparseDocumentOptions = {
  model: "qdrant/bm25",
};
const DEFAULT_HYBRID_FUSION: QdrantHybridFusion = { fusion: "rrf" };

/**
 * How `QdrantVectorStore` indexes and searches documents:
 * - `"dense"`: a single dense vector, computed by the `embeddings` instance
 *   (default, the behaviour of previous versions);
 * - `"sparse"`: a single sparse vector, computed by Qdrant (server-side BM25)
 *   or by `sparseEmbeddings`;
 * - `"hybrid"`: both, fused at query time by Qdrant's Query API.
 */
export type QdrantRetrievalMode = "dense" | "sparse" | "hybrid";

/**
 * A sparse vector, as accepted by Qdrant.
 */
export type SparseVector = { indices: number[]; values: number[] };

/**
 * Interface for models that compute sparse vectors on the client, such as
 * SPLADE or BM25. Documents and queries are separate methods because some
 * sparse models encode them differently.
 */
export interface SparseEmbeddingsInterface {
  embedDocuments(texts: string[]): Promise<SparseVector[]>;
  embedQuery(text: string): Promise<SparseVector>;
}

/**
 * Options of the Qdrant `Document` sent in place of a sparse vector when
 * Qdrant computes it server-side, e.g.
 * `{ model: "qdrant/bm25", options: { language: "italian" } }`.
 */
export type QdrantSparseDocumentOptions = Omit<
  QdrantSchemas["Document"],
  "text"
>;

/**
 * Fusion query used to combine the dense and sparse results in hybrid mode,
 * e.g. `{ fusion: "rrf" }`, `{ fusion: "dbsf" }` or
 * `{ rrf: { weights: [1, 3] } }` (Qdrant >= 1.17).
 */
export type QdrantHybridFusion =
  | QdrantSchemas["FusionQuery"]
  | QdrantSchemas["RrfQuery"];

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
  /**
   * Retrieval mode. Defaults to `"dense"`. `"sparse"` and `"hybrid"` need a
   * collection with the sparse vector: Qdrant >= 1.15.3 when Qdrant computes
   * it (BM25), or >= 1.10 with `sparseEmbeddings`.
   */
  retrievalMode?: QdrantRetrievalMode;
  /**
   * Name of the dense vector. Defaults to `""`, the unnamed vector.
   */
  vectorName?: string;
  /**
   * Name of the sparse vector. Defaults to `"langchain-sparse"`.
   */
  sparseVectorName?: string;
  /**
   * Computes sparse vectors on the client. When not set, Qdrant computes them
   * from a `Document` built with `sparseDocumentOptions`.
   */
  sparseEmbeddings?: SparseEmbeddingsInterface;
  /**
   * Model and options of the server-side sparse model, used when
   * `sparseEmbeddings` is not set. Defaults to `{ model: "qdrant/bm25" }`.
   */
  sparseDocumentOptions?: QdrantSparseDocumentOptions;
  /**
   * Fusion used in hybrid mode. Defaults to `{ fusion: "rrf" }`.
   */
  hybridFusion?: QdrantHybridFusion;
}

export type QdrantAddDocumentOptions = {
  ids?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customPayload?: Record<string, any>[];
};

/**
 * Type that defines the parameters for the delete operation in the
 * QdrantStore class. It includes ids, filter and shard key.
 */
export type QdrantDeleteParams =
  | { ids: string[]; shardKey?: string; filter?: never }
  | { filter: object; shardKey?: string; ids?: never };

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
 *
 * With `retrievalMode: "hybrid"` or `"sparse"`, `similaritySearch`,
 * `similaritySearchWithScore` and retrievers created with `asRetriever()`
 * also search a sparse vector. Notes:
 * - in hybrid mode, scores are fusion scores, not similarities, so score
 *   thresholds are not meaningful;
 * - `similaritySearchVectorWithScore` and `maxMarginalRelevanceSearch` always
 *   search the dense vector, and are not available in sparse mode;
 * - a sparse vector cannot be added to an existing collection, so hybrid and
 *   sparse mode need a collection created with it;
 * - `embeddings` is still required in sparse mode, where it is not used.
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

  retrievalMode: QdrantRetrievalMode;

  vectorName: string;

  sparseVectorName: string;

  sparseEmbeddings?: SparseEmbeddingsInterface;

  sparseDocumentOptions: QdrantSparseDocumentOptions;

  hybridFusion: QdrantHybridFusion;

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

    this.retrievalMode = args.retrievalMode ?? "dense";

    this.vectorName = args.vectorName ?? "";

    this.sparseVectorName = args.sparseVectorName ?? DEFAULT_SPARSE_VECTOR_NAME;

    this.sparseEmbeddings = args.sparseEmbeddings;

    this.sparseDocumentOptions =
      args.sparseDocumentOptions ?? DEFAULT_SPARSE_DOCUMENT_OPTIONS;

    this.hybridFusion = args.hybridFusion ?? DEFAULT_HYBRID_FUSION;
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
    if (this.retrievalMode === "sparse") {
      await this._upsertPoints(documents, undefined, documentOptions);
      return;
    }
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
   * In hybrid mode, the sparse vectors are also computed from the documents'
   * `pageContent`. Not available in sparse mode.
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
    this._assertDenseAvailable("addVectors");
    if (vectors.length === 0) {
      return;
    }
    await this._upsertPoints(documents, vectors, documentOptions);
  }

  /**
   * Builds the points for `documents`, with the dense and/or sparse vectors
   * required by the retrieval mode, and upserts them.
   */
  protected async _upsertPoints(
    documents: Document[],
    denseVectors: number[][] | undefined,
    documentOptions?: QdrantAddDocumentOptions
  ): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    await this.ensureCollection();

    const sparseVectors =
      this.retrievalMode === "dense"
        ? undefined
        : await this._sparseDocumentVectors(
            documents.map(({ pageContent }) => pageContent)
          );

    const points = documents.map((document, idx) => ({
      id: document.id ?? documentOptions?.ids?.[idx] ?? uuid(),
      vector: this._pointVector(denseVectors?.[idx], sparseVectors?.[idx]),
      payload: {
        [this.contentPayloadKey]: document.pageContent,
        [this.metadataPayloadKey]: document.metadata,
        customPayload: documentOptions?.customPayload?.[idx],
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
   * Returns the `vector` field of a point for the current retrieval mode.
   */
  private _pointVector(
    dense: number[] | undefined,
    sparse: QdrantSchemas["Vector"] | undefined
  ): QdrantSchemas["VectorStruct"] {
    if (this.retrievalMode === "dense") {
      return this.vectorName ? { [this.vectorName]: dense } : (dense ?? []);
    }
    if (this.retrievalMode === "sparse") {
      return { [this.sparseVectorName]: sparse };
    }
    return { [this.vectorName]: dense, [this.sparseVectorName]: sparse };
  }

  /**
   * Sparse vectors for documents: computed by `sparseEmbeddings` when set,
   * otherwise Qdrant `Document`s that the server turns into sparse vectors.
   */
  private async _sparseDocumentVectors(
    texts: string[]
  ): Promise<QdrantSchemas["Vector"][]> {
    if (this.sparseEmbeddings) {
      return this.sparseEmbeddings.embedDocuments(texts);
    }
    return texts.map((text) => ({ text, ...this.sparseDocumentOptions }));
  }

  /**
   * Sparse vector for a query: computed by `sparseEmbeddings` when set,
   * otherwise a Qdrant `Document` that the server turns into a sparse vector.
   */
  private async _sparseQueryVector(
    text: string
  ): Promise<QdrantSchemas["VectorInput"]> {
    if (this.sparseEmbeddings) {
      return this.sparseEmbeddings.embedQuery(text);
    }
    return { text, ...this.sparseDocumentOptions };
  }

  /**
   * `using` for queries on the dense vector; omitted for the unnamed vector,
   * so that requests in dense mode stay the same as before.
   */
  private _denseUsing(): { using?: string } {
    return this.vectorName ? { using: this.vectorName } : {};
  }

  private _assertDenseAvailable(method: string): void {
    if (this.retrievalMode === "sparse") {
      throw new Error(
        `${method} is not supported in "sparse" retrieval mode, since the collection has no dense vector. Use similaritySearch or similaritySearchWithScore instead, or the "dense" or "hybrid" retrieval mode.`
      );
    }
  }

  private _toDocument(point: QdrantSchemas["ScoredPoint"]): Document {
    const res = point as QdrantSearchResponse;
    return new Document({
      id: res.id as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: res.payload[this.metadataPayloadKey] as Record<string, any>,
      pageContent: res.payload[this.contentPayloadKey] as string,
    });
  }

  /**
   * Searches by query text: a single query on the sparse vector in sparse
   * mode, or a fusion of a dense and a sparse prefetch in hybrid mode.
   */
  private async _searchByText(
    query: string,
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    const sparseQuery = await this._sparseQueryVector(query);

    await this.ensureCollection();

    const common = {
      limit: k,
      filter,
      with_payload: [this.metadataPayloadKey, this.contentPayloadKey],
      with_vector: false,
    };

    const request =
      this.retrievalMode === "sparse"
        ? { query: sparseQuery, using: this.sparseVectorName, ...common }
        : {
            prefetch: [
              {
                query: await this.embeddings.embedQuery(query),
                ...this._denseUsing(),
                limit: k,
                filter,
              },
              {
                query: sparseQuery,
                using: this.sparseVectorName,
                limit: k,
                filter,
              },
            ],
            query: this.hybridFusion,
            ...common,
          };

    const { points } = await this.client.query(this.collectionName, request);
    return points.map((point) => [this._toDocument(point), point.score]);
  }

  /**
   * Searches for documents similar to a text query. In sparse and hybrid
   * mode, it also searches the sparse vector.
   * @param query Text query.
   * @param k Number of results to return. Defaults to 4.
   * @param filter Optional filter to apply to the search.
   * @param _callbacks Unused.
   * @returns Promise that resolves with the matching documents.
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    _callbacks: Callbacks | undefined = undefined
  ): Promise<Document[]> {
    if (this.retrievalMode === "dense") {
      return super.similaritySearch(query, k, filter, _callbacks);
    }
    const results = await this._searchByText(query, k, filter);
    return results.map(([document]) => document);
  }

  /**
   * Searches for documents similar to a text query, with their scores. In
   * hybrid mode, scores are fusion scores, not similarities.
   * @param query Text query.
   * @param k Number of results to return. Defaults to 4.
   * @param filter Optional filter to apply to the search.
   * @param _callbacks Unused.
   * @returns Promise that resolves with `[document, score]` tuples.
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    _callbacks: Callbacks | undefined = undefined
  ): Promise<[Document, number][]> {
    if (this.retrievalMode === "dense") {
      return super.similaritySearchWithScore(query, k, filter, _callbacks);
    }
    return this._searchByText(query, k, filter);
  }

  /**
   * Method that deletes points from the Qdrant database.
   * @param params Parameters for the delete operation.
   * @returns Promise that resolves when the delete operation is complete.
   */
  async delete(params: QdrantDeleteParams): Promise<void> {
    const { ids, filter, shardKey } = params;

    if (ids) {
      const batchSize = 1000;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        await this.client.delete(this.collectionName, {
          wait: true,
          ordering: "weak",
          points: batchIds,
          shard_key: shardKey,
        });
      }
    } else if (filter) {
      await this.client.delete(this.collectionName, {
        wait: true,
        ordering: "weak",
        filter,
        shard_key: shardKey,
      });
    } else {
      throw new Error("Either ids or filter must be provided.");
    }
  }

  /**
   * Method to search for vectors in the Qdrant database that are similar to
   * a given query vector. The search results include the score and payload
   * (metadata and content) for each similar vector. It always searches the
   * dense vector, and is not available in sparse mode.
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
    this._assertDenseAvailable("similaritySearchVectorWithScore");

    if (!query) {
      return [];
    }

    await this.ensureCollection();

    const results = (
      await this.client.query(this.collectionName, {
        query,
        ...this._denseUsing(),
        limit: k,
        filter,
        with_payload: [this.metadataPayloadKey, this.contentPayloadKey],
        with_vector: false,
      })
    ).points;

    return results.map((res) => [this._toDocument(res), res.score]);
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents. It always searches the dense vector, and is not
   * available in sparse mode.
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
    this._assertDenseAvailable("maxMarginalRelevanceSearch");

    if (!query) {
      return [];
    }

    const queryEmbedding = await this.embeddings.embedQuery(query);

    await this.ensureCollection();

    const results = (
      await this.client.query(this.collectionName, {
        query: {
          nearest: queryEmbedding,
          mmr: {
            diversity: options.lambda ?? null,
            candidates_limit: options?.fetchK ?? 20,
          },
        },
        ...this._denseUsing(),
        limit: options.k,
        filter: options?.filter,
        with_payload: [this.metadataPayloadKey, this.contentPayloadKey],
        with_vector: true,
      })
    ).points;

    return results.map((res) => this._toDocument(res));
  }

  /**
   * Method to ensure the existence of a collection in the Qdrant database.
   * If the collection does not exist, it is created, unless a
   * `collectionConfig` is given, with the vectors required by the retrieval
   * mode: the dense vector in dense mode, the sparse vector in sparse mode,
   * both in hybrid mode. The sparse vector uses the `idf` modifier when Qdrant
   * computes it (BM25).
   * @returns Promise that resolves when the existence of the collection has been ensured.
   */
  async ensureCollection() {
    const response = await this.client.getCollections();

    const collectionNames = response.collections.map(
      (collection) => collection.name
    );

    if (!collectionNames.includes(this.collectionName)) {
      const collectionConfig =
        this.collectionConfig ?? (await this._defaultCollectionConfig());
      await this.client.createCollection(this.collectionName, collectionConfig);
    }
  }

  private async _defaultCollectionConfig(): Promise<
    QdrantSchemas["CreateCollection"]
  > {
    let vectors: QdrantSchemas["VectorsConfig"] = {};
    if (this.retrievalMode !== "sparse") {
      const params: QdrantSchemas["VectorParams"] = {
        size: (await this.embeddings.embedQuery("test")).length,
        distance: "Cosine",
      };
      vectors = this.vectorName ? { [this.vectorName]: params } : params;
    }
    if (this.retrievalMode === "dense") {
      return { vectors };
    }
    return {
      vectors,
      sparse_vectors: {
        [this.sparseVectorName]: this.sparseEmbeddings
          ? {}
          : { modifier: "idf" },
      },
    };
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
