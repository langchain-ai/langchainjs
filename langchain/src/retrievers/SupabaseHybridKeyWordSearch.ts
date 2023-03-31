import type { SupabaseClient } from "@supabase/supabase-js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { BaseRetriever } from "../schema/index.js";

interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
}

interface kwSearchParams {
  query_text: string;
  match_count: number; // int
}

interface SearchEmbeddingsResponse {
  id: number;
  content: string;
  metadata: object;
  similarity: number;
}

interface kwSearchResponse {
  id: number;
  content: string;
  metadata: object;
  similarity: number;
}

export interface SupabaseLibArgs {
  client: SupabaseClient;
  tableName?: string;
  queryName?: string;
  kwQueryName?: string;
}

export interface SupabaseHybridKeyWordSearchParams {
  query: string;
  sim_k: number;
  kw_k: number;
}

export class SupabaseHybridKeyWordSearch extends BaseRetriever {
  sim_k: number;

  query: string;

  kw_k: number;

  queryName: string;

  client: SupabaseClient;

  tableName: string;

  kwQueryName: string;

  embeddings: Embeddings;

  constructor(
    embeddings: Embeddings,
    args: SupabaseLibArgs,
    sim_k: number,
    kw_k: number
  ) {
    super();
    this.embeddings = embeddings;
    this.client = args.client;
    this.tableName = args.tableName || "documents";
    this.queryName = args.queryName || "match_documents";
    this.kwQueryName = args.kwQueryName || "kw_match_documents";
    this.sim_k = sim_k;
    this.kw_k = kw_k;
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const matchDocumentsParams: SearchEmbeddingsParams = {
      query_embedding: query,
      match_count: k,
    };

    const { data: searches, error } = await this.client.rpc(
      this.queryName,
      matchDocumentsParams
    );

    if (error) {
      throw new Error(`Error searching for documents: ${error}`);
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
    console.log(result);
    return result;
  }

  async keywordSearch(query: string, k: number): Promise<[Document, number][]> {
    const kwMatchDocumentsParams: kwSearchParams = {
      query_text: query,
      match_count: k,
    };

    const { data: searches, error } = await this.client.rpc(
      this.kwQueryName,
      kwMatchDocumentsParams
    );

    if (error) {
      throw new Error(`Error searching for documents: ${error}`);
    }

    const result: [Document, number][] = (searches as kwSearchResponse[]).map(
      (resp) => [
        new Document({
          metadata: resp.metadata,
          pageContent: resp.content,
        }),
        resp.similarity * 10,
      ]
    );
    console.log(result);
    return result;
  }

  async SupabaseHybridKeyWordSearch(
    query: string,
    sim_k: number,
    kw_k: number
  ): Promise<[Document, number][]> {
    const simularity_search = this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      sim_k
    );
    const keyword_search = this.keywordSearch(query, kw_k);

    return Promise.all<[Document, number][]>([
      simularity_search,
      keyword_search,
    ])
      .then((results) => results.flat())
      .then((results) => {
        const seenContent = new Set();
        return results.filter(([doc]) => {
          const content = doc.pageContent;
          if (seenContent.has(content)) {
            return false;
          }
          seenContent.add(content);
          return true;
        });
      })
      .then((results) => results.sort((a, b) => b[1] - a[1]));
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const searchResults = await this.SupabaseHybridKeyWordSearch(
      query,
      this.sim_k,
      this.kw_k
    );
    return searchResults.map(([doc]) => doc);
  }
}
