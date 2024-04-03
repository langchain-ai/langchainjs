import type { EmbeddingsInterface } from "./embeddings.js";
import type { DocumentInterface } from "./documents/document.js";
import {
  BaseRetriever,
  BaseRetrieverInterface,
  type BaseRetrieverInput,
} from "./retrievers/index.js";
import { Serializable } from "./load/serializable.js";
import {
  CallbackManagerForRetrieverRun,
  Callbacks,
} from "./callbacks/manager.js";

/**
 * Type for options when adding a document to the VectorStore.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AddDocumentOptions = Record<string, any>;

/**
 * Type for options when performing a maximal marginal relevance search.
 */
export type MaxMarginalRelevanceSearchOptions<FilterType> = {
  k: number;
  fetchK?: number;
  lambda?: number;
  filter?: FilterType;
};

/**
 * Type for options when performing a maximal marginal relevance search
 * with the VectorStoreRetriever.
 */
export type VectorStoreRetrieverMMRSearchKwargs = {
  fetchK?: number;
  lambda?: number;
};

/**
 * Type for input when creating a VectorStoreRetriever instance.
 */
export type VectorStoreRetrieverInput<V extends VectorStoreInterface> =
  BaseRetrieverInput &
    (
      | {
          vectorStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType?: "similarity";
        }
      | {
          vectorStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType: "mmr";
          searchKwargs?: VectorStoreRetrieverMMRSearchKwargs;
        }
    );

export interface VectorStoreRetrieverInterface<
  V extends VectorStoreInterface = VectorStoreInterface
> extends BaseRetrieverInterface {
  vectorStore: V;

  addDocuments(
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | void>;
}

/**
 * Class for performing document retrieval from a VectorStore. Can perform
 * similarity search or maximal marginal relevance search.
 */
export class VectorStoreRetriever<
    V extends VectorStoreInterface = VectorStoreInterface
  >
  extends BaseRetriever
  implements VectorStoreRetrieverInterface
{
  static lc_name() {
    return "VectorStoreRetriever";
  }

  get lc_namespace() {
    return ["langchain_core", "vectorstores"];
  }

  vectorStore: V;

  k = 4;

  searchType = "similarity";

  searchKwargs?: VectorStoreRetrieverMMRSearchKwargs;

  filter?: V["FilterType"];

  _vectorstoreType(): string {
    return this.vectorStore._vectorstoreType();
  }

  constructor(fields: VectorStoreRetrieverInput<V>) {
    super(fields);
    this.vectorStore = fields.vectorStore;
    this.k = fields.k ?? this.k;
    this.searchType = fields.searchType ?? this.searchType;
    this.filter = fields.filter;
    if (fields.searchType === "mmr") {
      this.searchKwargs = fields.searchKwargs;
    }
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<DocumentInterface[]> {
    if (this.searchType === "mmr") {
      if (typeof this.vectorStore.maxMarginalRelevanceSearch !== "function") {
        throw new Error(
          `The vector store backing this retriever, ${this._vectorstoreType()} does not support max marginal relevance search.`
        );
      }
      return this.vectorStore.maxMarginalRelevanceSearch(
        query,
        {
          k: this.k,
          filter: this.filter,
          ...this.searchKwargs,
        },
        runManager?.getChild("vectorstore")
      );
    }
    return this.vectorStore.similaritySearch(
      query,
      this.k,
      this.filter,
      runManager?.getChild("vectorstore")
    );
  }

  async addDocuments(
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | void> {
    return this.vectorStore.addDocuments(documents, options);
  }
}

export interface VectorStoreInterface extends Serializable {
  FilterType: object | string;

  embeddings: EmbeddingsInterface;

  _vectorstoreType(): string;

  addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | void>;

  addDocuments(
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | void>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete(_params?: Record<string, any>): Promise<void>;

  similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[DocumentInterface, number][]>;

  similaritySearch(
    query: string,
    k?: number,
    filter?: this["FilterType"],
    callbacks?: Callbacks
  ): Promise<DocumentInterface[]>;

  similaritySearchWithScore(
    query: string,
    k?: number,
    filter?: this["FilterType"],
    callbacks?: Callbacks
  ): Promise<[DocumentInterface, number][]>;

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
   * @param {this["FilterType"]} options.filter - Optional filter
   * @param _callbacks
   *
   * @returns {Promise<DocumentInterface[]>} - List of documents selected by maximal marginal relevance.
   */
  maxMarginalRelevanceSearch?(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>,
    callbacks: Callbacks | undefined
  ): Promise<DocumentInterface[]>;

  asRetriever(
    kOrFields?: number | Partial<VectorStoreRetrieverInput<this>>,
    filter?: this["FilterType"],
    callbacks?: Callbacks,
    tags?: string[],
    metadata?: Record<string, unknown>,
    verbose?: boolean
  ): VectorStoreRetriever<this>;
}

/**
 * Abstract class representing a store of vectors. Provides methods for
 * adding vectors and documents, deleting from the store, and searching
 * the store.
 */
export abstract class VectorStore
  extends Serializable
  implements VectorStoreInterface
{
  declare FilterType: object | string;

  // Only ever instantiated in main LangChain
  lc_namespace = ["langchain", "vectorstores", this._vectorstoreType()];

  embeddings: EmbeddingsInterface;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(embeddings: EmbeddingsInterface, dbConfig: Record<string, any>) {
    super(dbConfig);
    this.embeddings = embeddings;
  }

  abstract _vectorstoreType(): string;

  abstract addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | void>;

  abstract addDocuments(
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | void>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async delete(_params?: Record<string, any>): Promise<void> {
    throw new Error("Not implemented.");
  }

  abstract similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[DocumentInterface, number][]>;

  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    _callbacks: Callbacks | undefined = undefined // implement passing to embedQuery later
  ): Promise<DocumentInterface[]> {
    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k,
      filter
    );

    return results.map((result) => result[0]);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    _callbacks: Callbacks | undefined = undefined // implement passing to embedQuery later
  ): Promise<[DocumentInterface, number][]> {
    return this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k,
      filter
    );
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
   * @param {this["FilterType"]} options.filter - Optional filter
   * @param _callbacks
   *
   * @returns {Promise<DocumentInterface[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch?(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>,
    _callbacks: Callbacks | undefined // implement passing to embedQuery later
  ): Promise<DocumentInterface[]>;

  static fromTexts(
    _texts: string[],
    _metadatas: object[] | object,
    _embeddings: EmbeddingsInterface,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "the Langchain vectorstore implementation you are using forgot to override this, please report a bug"
    );
  }

  static fromDocuments(
    _docs: DocumentInterface[],
    _embeddings: EmbeddingsInterface,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "the Langchain vectorstore implementation you are using forgot to override this, please report a bug"
    );
  }

  asRetriever(
    kOrFields?: number | Partial<VectorStoreRetrieverInput<this>>,
    filter?: this["FilterType"],
    callbacks?: Callbacks,
    tags?: string[],
    metadata?: Record<string, unknown>,
    verbose?: boolean
  ): VectorStoreRetriever<this> {
    if (typeof kOrFields === "number") {
      return new VectorStoreRetriever({
        vectorStore: this,
        k: kOrFields,
        filter,
        tags: [...(tags ?? []), this._vectorstoreType()],
        metadata,
        verbose,
        callbacks,
      });
    } else {
      const params = {
        vectorStore: this,
        k: kOrFields?.k,
        filter: kOrFields?.filter,
        tags: [...(kOrFields?.tags ?? []), this._vectorstoreType()],
        metadata: kOrFields?.metadata,
        verbose: kOrFields?.verbose,
        callbacks: kOrFields?.callbacks,
        searchType: kOrFields?.searchType,
      };
      if (kOrFields?.searchType === "mmr") {
        return new VectorStoreRetriever({
          ...params,
          searchKwargs: kOrFields.searchKwargs,
        });
      }
      return new VectorStoreRetriever({ ...params });
    }
  }
}

/**
 * Abstract class extending VectorStore with functionality for saving and
 * loading the vector store.
 */
export abstract class SaveableVectorStore extends VectorStore {
  abstract save(directory: string): Promise<void>;

  static load(
    _directory: string,
    _embeddings: EmbeddingsInterface
  ): Promise<SaveableVectorStore> {
    throw new Error("Not implemented");
  }
}
