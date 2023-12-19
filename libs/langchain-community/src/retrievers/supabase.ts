import type { SupabaseClient } from "@supabase/supabase-js";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import {
  CallbackManagerForRetrieverRun,
  Callbacks,
} from "@langchain/core/callbacks/manager";

interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
  filter?: Record<string, unknown>; // jsonb
}

interface SearchKeywordParams {
  query_text: string;
  match_count: number; // int
}

interface SearchResponseRow {
  id: number;
  content: string;
  metadata: object;
  similarity: number;
}

type SearchResult = [Document, number, number];

export interface SupabaseLibArgs extends BaseRetrieverInput {
  client: SupabaseClient;
  /**
   * The table name on Supabase. Defaults to "documents".
   */
  tableName?: string;
  /**
   * The name of the Similarity search function on Supabase. Defaults to "match_documents".
   */
  similarityQueryName?: string;
  /**
   * The name of the Keyword search function on Supabase. Defaults to "kw_match_documents".
   */
  keywordQueryName?: string;
  /**
   * The number of documents to return from the similarity search. Defaults to 2.
   */
  similarityK?: number;
  /**
   * The number of documents to return from the keyword search. Defaults to 2.
   */
  keywordK?: number;
}

export interface SupabaseHybridSearchParams {
  query: string;
  similarityK: number;
  keywordK: number;
}

/**
 * Class for performing hybrid search operations on a Supabase database.
 * It extends the `BaseRetriever` class and implements methods for
 * similarity search, keyword search, and hybrid search.
 */
export class SupabaseHybridSearch extends BaseRetriever {
  static lc_name() {
    return "SupabaseHybridSearch";
  }

  lc_namespace = ["langchain", "retrievers", "supabase"];

  similarityK: number;

  query: string;

  keywordK: number;

  similarityQueryName: string;

  client: SupabaseClient;

  tableName: string;

  keywordQueryName: string;

  embeddings: Embeddings;

  constructor(embeddings: Embeddings, args: SupabaseLibArgs) {
    super(args);
    this.embeddings = embeddings;
    this.client = args.client;
    this.tableName = args.tableName || "documents";
    this.similarityQueryName = args.similarityQueryName || "match_documents";
    this.keywordQueryName = args.keywordQueryName || "kw_match_documents";
    this.similarityK = args.similarityK || 2;
    this.keywordK = args.keywordK || 2;
  }

  /**
   * Performs a similarity search on the Supabase database using the
   * provided query and returns the top 'k' similar documents.
   * @param query The query to use for the similarity search.
   * @param k The number of top similar documents to return.
   * @param _callbacks Optional callbacks to pass to the embedQuery method.
   * @returns A promise that resolves to an array of search results. Each result is a tuple containing a Document, its similarity score, and its ID.
   */
  protected async similaritySearch(
    query: string,
    k: number,
    _callbacks?: Callbacks // implement passing to embedQuery later
  ): Promise<SearchResult[]> {
    const embeddedQuery = await this.embeddings.embedQuery(query);

    const matchDocumentsParams: SearchEmbeddingsParams = {
      query_embedding: embeddedQuery,
      match_count: k,
    };

    if (Object.keys(this.metadata ?? {}).length > 0) {
      matchDocumentsParams.filter = this.metadata;
    }

    const { data: searches, error } = await this.client.rpc(
      this.similarityQueryName,
      matchDocumentsParams
    );

    if (error) {
      throw new Error(
        `Error searching for documents: ${error.code} ${error.message} ${error.details}`
      );
    }

    return (searches as SearchResponseRow[]).map((resp) => [
      new Document({
        metadata: resp.metadata,
        pageContent: resp.content,
      }),
      resp.similarity,
      resp.id,
    ]);
  }

  /**
   * Performs a keyword search on the Supabase database using the provided
   * query and returns the top 'k' documents that match the keywords.
   * @param query The query to use for the keyword search.
   * @param k The number of top documents to return that match the keywords.
   * @returns A promise that resolves to an array of search results. Each result is a tuple containing a Document, its similarity score multiplied by 10, and its ID.
   */
  protected async keywordSearch(
    query: string,
    k: number
  ): Promise<SearchResult[]> {
    const kwMatchDocumentsParams: SearchKeywordParams = {
      query_text: query,
      match_count: k,
    };

    const { data: searches, error } = await this.client.rpc(
      this.keywordQueryName,
      kwMatchDocumentsParams
    );

    if (error) {
      throw new Error(
        `Error searching for documents: ${error.code} ${error.message} ${error.details}`
      );
    }

    return (searches as SearchResponseRow[]).map((resp) => [
      new Document({
        metadata: resp.metadata,
        pageContent: resp.content,
      }),
      resp.similarity * 10,
      resp.id,
    ]);
  }

  /**
   * Combines the results of the `similaritySearch` and `keywordSearch`
   * methods and returns the top 'k' documents based on a combination of
   * similarity and keyword matching.
   * @param query The query to use for the hybrid search.
   * @param similarityK The number of top similar documents to return.
   * @param keywordK The number of top documents to return that match the keywords.
   * @param callbacks Optional callbacks to pass to the similaritySearch method.
   * @returns A promise that resolves to an array of search results. Each result is a tuple containing a Document, its combined score, and its ID.
   */
  protected async hybridSearch(
    query: string,
    similarityK: number,
    keywordK: number,
    callbacks?: Callbacks
  ): Promise<SearchResult[]> {
    const similarity_search = this.similaritySearch(
      query,
      similarityK,
      callbacks
    );

    const keyword_search = this.keywordSearch(query, keywordK);

    return Promise.all([similarity_search, keyword_search])
      .then((results) => results.flat())
      .then((results) => {
        const picks = new Map<number, SearchResult>();

        results.forEach((result) => {
          const id = result[2];
          const nextScore = result[1];
          const prevScore = picks.get(id)?.[1];

          if (prevScore === undefined || nextScore > prevScore) {
            picks.set(id, result);
          }
        });

        return Array.from(picks.values());
      })
      .then((results) => results.sort((a, b) => b[1] - a[1]));
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const searchResults = await this.hybridSearch(
      query,
      this.similarityK,
      this.keywordK,
      runManager?.getChild("hybrid_search")
    );

    return searchResults.map(([doc]) => doc);
  }
}
