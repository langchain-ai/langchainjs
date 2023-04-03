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
  similarityQueryName?: string;
  keywordQueryName?: string;
  /**
   * The number of documents to return from the similarity search
   */
  similarityK?: number;
  /**
   * The number of documents to return from the keyword search
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
  ): Promise<[Document, number][]> {
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
    return result;
  }

  protected async keywordSearch(
    query: string,
    k: number
  ): Promise<[Document, number][]> {
    const kwMatchDocumentsParams: kwSearchParams = {
      query_text: query,
      match_count: k,
    };

    const { data: searches, error } = await this.client.rpc(
      this.keywordQueryName,
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
    return result;
  }

  protected async hybridSearch(
    query: string,
    similarityK: number,
    keywordK: number
  ): Promise<[Document, number][]> {
    const similarity_search = this.similaritySearch(query, similarityK);

    const keyword_search = this.keywordSearch(query, keywordK);

    return Promise.all<[Document, number][]>([
      similarity_search,
      keyword_search,
    ])
      .then((results) => results.flat())
      .then((results) => {
        const seenContent = new Map<string, number>();
        const uniqueResults: [Document, number][] = [];

        results.forEach(([doc, num]) => {
          const content = doc.pageContent;
          if (seenContent.has(content)) {
            const existingNum = seenContent.get(content);
            if (existingNum && num > existingNum) {
              seenContent.set(content, num);
              const index = uniqueResults.findIndex(
                ([uniqueDoc]) => uniqueDoc.pageContent === content
              );
              uniqueResults[index] = [doc, num];
            }
          } else {
            seenContent.set(content, num);
            uniqueResults.push([doc, num]);
          }
        });

        return uniqueResults;
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
