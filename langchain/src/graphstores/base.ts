import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { BaseRetriever, BaseRetrieverInput } from "../schema/retriever.js";
import { Serializable } from "../load/serializable.js";
import {
  CallbackManagerForRetrieverRun,
  Callbacks,
} from "../callbacks/manager.js";

/**
 * Type for options when adding a document to the GraphStore.
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
 * with the GraphStoreRetriever.
 */
export type GraphStoreRetrieverMMRSearchKwargs = {
  fetchK?: number;
  lambda?: number;
};

/**
 * Type for input when creating a GraphStoreRetriever instance.
 */
export type GraphStoreRetrieverInput<V extends GraphStore> =
  BaseRetrieverInput &
    (
      | {
          graphStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType?: "similarity";
        }
      | {
          graphStore: V;
          k?: number;
          filter?: V["FilterType"];
          searchType: "mmr";
          searchKwargs?: GraphStoreRetrieverMMRSearchKwargs;
        }
    );

/**
 * Class for performing document retrieval from a GraphStore. Can perform
 * similarity search or maximal marginal relevance search.
 */
export class GraphStoreRetriever<
  V extends GraphStore = GraphStore
> extends BaseRetriever {
  static lc_name() {
    return "GraphStoreRetriever";
  }

  get lc_namespace() {
    return ["langchain", "retrievers", "base"];
  }

  graphStore: V;

  k = 4;

  searchType = "similarity";

  searchKwargs?: GraphStoreRetrieverMMRSearchKwargs;

  filter?: V["FilterType"];

  _graphStoreType(): string {
    return this.graphStore._graphstoreType();
  }

  constructor(fields: GraphStoreRetrieverInput<V>) {
    super(fields);
    this.graphStore = fields.graphStore;
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
  ): Promise<Document[]> {
    if (this.searchType === "mmr") {
      if (typeof this.graphStore.maxMarginalRelevanceSearch !== "function") {
        throw new Error(
          `The graph store backing this retriever, ${this._graphStoreType()} does not support max marginal relevance search.`
        );
      }
      return this.graphStore.maxMarginalRelevanceSearch(
        query,
        {
          k: this.k,
          filter: this.filter,
          ...this.searchKwargs,
        },
        runManager?.getChild("graphStore")
      );
    }
    return this.graphStore.similaritySearch(
      query,
      this.k,
      this.filter,
      runManager?.getChild("graphStore")
    );
  }

  async addDocuments(
    documents: Document[],
    options?: AddDocumentOptions
  ): Promise<string[] | void> {
    return this.graphStore.addDocuments(documents, options);
  }
}

/**
 * Abstract class representing a store of a graph. Provides methods for
 * adding nodes and edges, deleting from the store, and searching
 * the store.
 */
export abstract class GraphStore extends Serializable {
  declare FilterType: object | string;

  lc_namespace = ["langchain", "graphstores", this._graphstoreType()];

  embeddings: Embeddings;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(embeddings: Embeddings, dbConfig: Record<string, any>) {
    super(dbConfig);
    this.embeddings = embeddings;
  }

  abstract _graphstoreType(): string;

  abstract addVectors(
    vectors: number[][],
    documents: Document[],
    options?: AddDocumentOptions
  ): Promise<string[] | void>;

  abstract addDocuments(
    documents: Document[],
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
  ): Promise<[Document, number][]>;

  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    _callbacks: Callbacks | undefined = undefined // implement passing to embedQuery later
  ): Promise<Document[]> {
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
  ): Promise<[Document, number][]> {
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
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch?(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>,
    _callbacks: Callbacks | undefined // implement passing to embedQuery later
  ): Promise<Document[]>;

  static fromTexts(
    _texts: string[],
    _metadatas: object[] | object,
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<GraphStore> {
    throw new Error(
      "the Langchain graphStore implementation you are using forgot to override this, please report a bug"
    );
  }

  static fromDocuments(
    _docs: Document[],
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<GraphStore> {
    throw new Error(
      "the Langchain graphStore implementation you are using forgot to override this, please report a bug"
    );
  }

  asRetriever(
    kOrFields?: number | Partial<GraphStoreRetrieverInput<this>>,
    filter?: this["FilterType"],
    callbacks?: Callbacks,
    tags?: string[],
    metadata?: Record<string, unknown>,
    verbose?: boolean
  ): GraphStoreRetriever<this> {
    if (typeof kOrFields === "number") {
      return new GraphStoreRetriever({
        graphStore: this,
        k: kOrFields,
        filter,
        tags: [...(tags ?? []), this._graphstoreType()],
        metadata,
        verbose,
        callbacks,
      });
    } else {
      const params = {
        graphStore: this,
        k: kOrFields?.k,
        filter: kOrFields?.filter,
        tags: [...(kOrFields?.tags ?? []), this._graphstoreType()],
        metadata: kOrFields?.metadata,
        verbose: kOrFields?.verbose,
        callbacks: kOrFields?.callbacks,
        searchType: kOrFields?.searchType,
      };
      if (kOrFields?.searchType === "mmr") {
        return new GraphStoreRetriever({
          ...params,
          searchKwargs: kOrFields.searchKwargs,
        });
      }
      return new GraphStoreRetriever({ ...params });
    }
  }
}

/**
 * Abstract class extending GraphStore with functionality for saving and
 * loading the vector store.
 */
export abstract class SaveableGraphStore extends GraphStore {
  abstract save(directory: string): Promise<void>;

  static load(
    _directory: string,
    _embeddings: Embeddings
  ): Promise<SaveableGraphStore> {
    throw new Error("Not implemented");
  }
}
