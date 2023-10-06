import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { MaxMarginalRelevanceSearchOptions, VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { maximalMarginalRelevance } from "../util/math.js";

/**
 * Interface for the parameters required for searching embeddings.
 */
interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
  filter?: SupabaseMetadata | SupabaseFilterRPCCall;
  include_embeddings?: boolean;
}

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
export type SupabaseMetadata = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
export type SupabaseFilter = PostgrestFilterBuilder<any, any, any>;
export type SupabaseFilterRPCCall = (rpcCall: SupabaseFilter) => SupabaseFilter;

/**
 * Interface for options to pass to similarity search.
 */
type SearchOptions = {
  includeEmbeddings?: boolean;
};

/**
 * Interface for the response returned when searching embeddings.
 */
interface SearchEmbeddingsResponse {
  id: number;
  content: string;
  metadata: object;
  similarity: number;
}

/**
 * Interface for the arguments required to initialize a Supabase library.
 */
export interface SupabaseLibArgs {
  client: SupabaseClient;
  tableName?: string;
  queryName?: string;
  filter?: SupabaseMetadata | SupabaseFilterRPCCall;
  searchOptions?: SearchOptions;
  upsertBatchSize?: number;
  embeddingKey?: string;
}

/**
 * Class for interacting with a Supabase database to store and manage
 * vectors.
 */
export class SupabaseVectorStore extends VectorStore {
  declare FilterType: (SupabaseMetadata | SupabaseFilterRPCCall) &
    SearchOptions;

  client: SupabaseClient;

  tableName: string;

  queryName: string;

  filter?: SupabaseMetadata | SupabaseFilterRPCCall;

  searchOptions: SearchOptions = {};

  upsertBatchSize = 500;

  embeddingKey: string;

  _vectorstoreType(): string {
    return "supabase";
  }

  constructor(embeddings: Embeddings, args: SupabaseLibArgs) {
    super(embeddings, args);

    this.client = args.client;
    this.tableName = args.tableName || "documents";
    this.queryName = args.queryName || "match_documents";
    this.filter = args.filter;
    this.searchOptions.includeEmbeddings =
      args.searchOptions?.includeEmbeddings ?? false;
    this.upsertBatchSize = args.upsertBatchSize ?? this.upsertBatchSize;
    this.embeddingKey = args.embeddingKey || "embedding";
  }

  /**
   * Adds documents to the vector store.
   * @param documents The documents to add.
   * @param options Optional parameters for adding the documents.
   * @returns A promise that resolves when the documents have been added.
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] | number[] }
  ) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Adds vectors to the vector store.
   * @param vectors The vectors to add.
   * @param documents The documents associated with the vectors.
   * @param options Optional parameters for adding the vectors.
   * @returns A promise that resolves with the IDs of the added vectors when the vectors have been added.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] | number[] }
  ) {
    const rows = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    // upsert returns 500/502/504 (yes really any of them) if given too many rows/characters
    // ~2000 trips it, but my data is probably smaller than average pageContent and metadata
    let returnedIds: string[] = [];
    for (let i = 0; i < rows.length; i += this.upsertBatchSize) {
      const chunk = rows.slice(i, i + this.upsertBatchSize).map((row, j) => {
        if (options?.ids) {
          return { id: options.ids[i + j], ...row };
        }
        return row;
      });

      const res = await this.client.from(this.tableName).upsert(chunk).select();
      if (res.error) {
        throw new Error(
          `Error inserting: ${res.error.message} ${res.status} ${res.statusText}`
        );
      }
      if (res.data) {
        returnedIds = returnedIds.concat(res.data.map((row) => row.id));
      }
    }
    return returnedIds;
  }

  /**
   * Deletes vectors from the vector store.
   * @param params The parameters for deleting vectors.
   * @returns A promise that resolves when the vectors have been deleted.
   */
  async delete(params: { ids: string[] | number[] }): Promise<void> {
    const { ids } = params;
    for (const id of ids) {
      await this.client.from(this.tableName).delete().eq("id", id);
    }
  }

  /**
   * Performs a similarity search on the vector store.
   * @param query The query vector.
   * @param k The number of results to return.
   * @param filter Optional filter to apply to the search.
   * @returns A promise that resolves with the search results when the search is complete.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }

    const _filter = filter ?? this.filter ?? {};
    const searchOptions: SearchOptions = {
      includeEmbeddings:
        filter?.includeEmbeddings ?? this.searchOptions.includeEmbeddings,
    };

    const matchDocumentsParams: Partial<SearchEmbeddingsParams> = {
      query_embedding: query,
      include_embeddings: searchOptions.includeEmbeddings,
    };

    let filterFunction: SupabaseFilterRPCCall;

    if (typeof _filter === "function") {
      filterFunction = (rpcCall) => _filter(rpcCall).limit(k);
    } else if (typeof _filter === "object") {
      // Make sure includeEmbeddings is not mistaken for a metadata filter
      matchDocumentsParams.filter = {
        ..._filter,
        includeEmbeddings: undefined,
      };
      matchDocumentsParams.match_count = k;
      filterFunction = (rpcCall) => rpcCall;
    } else {
      throw new Error("invalid filter type");
    }

    const rpcCall = this.client.rpc(this.queryName, matchDocumentsParams);

    const { data: searches, error } = await filterFunction(rpcCall);

    if (error) {
      throw new Error(
        `Error searching for documents: ${error.code} ${error.message} ${error.details}`
      );
    }

    const result: [Document, number][] = (
      searches as SearchEmbeddingsResponse[]
    ).map((resp) => [
      new Document({
        metadata: resp.metadata,
        pageContent: resp.content,
      }),
      resp.similarity,
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
   * @param {number} options.fetchK=20- Number of documents to fetch before passing to the MMR algorithm.
   * @param {number} options.lambda=0.5 - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {SupabaseLibArgs} options.filter - Optional filter to apply to the search.
   * @param {boolean} options.includeEmbeddings - Option to include the embeddings of the found documents in the result.
   *
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]> &
      SearchOptions
  ): Promise<Document[]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);

    // preserve the original value of includeEmbeddings
    const includeEmbeddingsFlag = options?.includeEmbeddings || false;

    // update filter to include embeddings, as they will be used in MMR
    let filterAndSearchOptions
    if (typeof options.filter === "function") {
      // Create a new function, in order to not modify the function passed from the outside
      filterAndSearchOptions = (rpcCall: SupabaseFilter) => options.filter(rpcCall);
      filterAndSearchOptions.includeEmbeddings = true;
    } else {
      // Shallow clone the filter, in order to not modify the object passed from the outside
      filterAndSearchOptions = {
        ...options.filter,
        includeEmbeddings: true,
      };
    }

    const resultDocs = await this.similaritySearchVectorWithScore(
      queryEmbedding,
      options.fetchK ?? 20,
      filterAndSearchOptions
    );

    const embeddingList = resultDocs.map(
      (doc) => doc[0].metadata[this.embeddingKey]
    );

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      options.lambda,
      options.k
    );

    return mmrIndexes.map((idx) => {
      const doc = resultDocs[idx][0];

      // remove embeddings if they were not requested originally
      if (!includeEmbeddingsFlag) {
        delete doc.metadata[this.embeddingKey];
      }
      return doc;
    });
  }

  /**
   * Creates a new SupabaseVectorStore instance from an array of texts.
   * @param texts The texts to create documents from.
   * @param metadatas The metadata for the documents.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the Supabase database.
   * @returns A promise that resolves with a new SupabaseVectorStore instance when the instance has been created.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: SupabaseLibArgs
  ): Promise<SupabaseVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return SupabaseVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Creates a new SupabaseVectorStore instance from an array of documents.
   * @param docs The documents to create the instance from.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the Supabase database.
   * @returns A promise that resolves with a new SupabaseVectorStore instance when the instance has been created.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: SupabaseLibArgs
  ): Promise<SupabaseVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Creates a new SupabaseVectorStore instance from an existing index.
   * @param embeddings The embeddings to use.
   * @param dbConfig The configuration for the Supabase database.
   * @returns A promise that resolves with a new SupabaseVectorStore instance when the instance has been created.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: SupabaseLibArgs
  ): Promise<SupabaseVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
