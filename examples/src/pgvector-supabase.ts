/// This is a vector implementation for a serverless pgsql server, in the style of supabase
/// blogpost https://supabase.com/blog/openai-embeddings-postgres-vector

/// Note, out of the box the blog post does not bother storing metadata, so this example doesnt either.
/// Note, I needed to add the #variable_conflict use_column to the blog post as it didnt
/// work out of the box for me

/// You need to have previously followed the blog post or go to the supabase sql editor
/// to run the following sql from their blog post

/// create extension vector;
///
/// create table documents (
///   id bigserial primary key,
///   content text,
///   embedding vector (1536)
/// );
///
/// create or replace function match_documents (
///   query_embedding vector(1536),
///   similarity_threshold float,
///   match_count int
/// )
/// returns table (
///   id bigint,
///   content text,
///   similarity float
/// )
/// language plpgsql
/// as $$
/// #variable_conflict use_column
/// begin
///   return query
///   select
///     id,
///     content,
///     1 - (documents.embedding <=> query_embedding) as similarity
///   from documents
///   where 1 - (documents.embedding <=> query_embedding) > similarity_threshold
///   order by documents.embedding <=> query_embedding
///   limit match_count;
/// end;
/// $$;
///
/// create index on documents
/// using ivfflat (embedding vector_cosine_ops)
/// with (lists = 100);

import { SupabaseClient } from "@supabase/supabase-js";
import { PGVectorClient } from "langchain/vectorstores";
import { Document } from "langchain/document";

export class PGClient implements PGVectorClient {
  client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    _ids?: string[]
  ): Promise<void> {
    await this.client.from("documents").upsert(
      vectors.map((embedding, idx) => ({
        content: documents[idx],
        embedding,
      }))
    );
    // console.log(error);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {

    type SearchEmbeddingsParams = {
      query_embedding: number[];
      similarity_threshold: number; // float
      match_count: number; // int
    };
    
    type SearchEmbeddingsResponse = {
      id: number;
      content: string;
      similarity: number;
    };

    const matchDocumentsParams: SearchEmbeddingsParams = {
      query_embedding: query,
      similarity_threshold: k,
      // todo pass through?
      match_count: 10,
    };

    // todo what to do with the error, throw?
    const { data: searches } = (await this.client.rpc(
      "match_documents",
      matchDocumentsParams
    )) as { data: SearchEmbeddingsResponse[]; error: unknown };

    const result: [Document, number][] = searches.map((resp) => {
      const obj = JSON.parse(resp.content);
      return [
        new Document({
          metadata: obj.metadata ?? ({} as Record<string, any>),
          pageContent: obj.pageContent,
        }),
        resp.similarity,
      ];
    });

    return result;
  }

  // can't run raw sql with supabase api, so you need to manually set up in dashboard
  prepare() {}
}
