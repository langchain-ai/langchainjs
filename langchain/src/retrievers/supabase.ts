import type { SupabaseClient } from "@supabase/supabase-js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";

interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
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

export interface SupabaseLibArgs {
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

export class SupabaseHybridSearch extends BaseRetriever {
  similarityK: number;

  query: string;

  keywordK: number;

  similarityQueryName: string;

  client: SupabaseClient;

  tableName: string;

  keywordQueryName: string;

  embeddings: Embeddings;

  constructor(embeddings: Embeddings, args: SupabaseLibArgs) {
    super();
    this.embeddings = embeddings;
    this.client = args.client;
    this.tableName = args.tableName || "documents";
    this.similarityQueryName = args.similarityQueryName || "match_documents";
    this.keywordQueryName = args.keywordQueryName || "kw_match_documents";
    this.similarityK = args.similarityK || 2;
    this.keywordK = args.keywordK || 2;
  }

  protected async similaritySearch(
    query: string,
    k: number
  ): Promise<SearchResult[]> {
    const embeddedQuery = await this.embeddings.embedQuery(query);

    const matchDocumentsParams: SearchEmbeddingsParams = {
      query_embedding: embeddedQuery,
      match_count: k,
    };

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

  protected async hybridSearch(
    query: string,
    similarityK: number,
    keywordK: number
  ): Promise<SearchResult[]> {
    const similarity_search = this.similaritySearch(query, similarityK);

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

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const searchResults = await this.hybridSearch(
      query,
      this.similarityK,
      this.keywordK
    );

    return searchResults.map(([doc]) => doc);
  }
}
