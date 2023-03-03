/// Youre not allowed to run raw sql on supabase apis I dont beleive
/// https://github.com/supabase/supabase/discussions/3419#discussioncomment-1428126
/// you need to follow the blogpost https://supabase.com/blog/openai-embeddings-postgres-vector
/// or simply execute this raw sql to setup the defaul query and table
/// Note, I needed to add the #variable_conflict use_column the blog post didnt work out of the box for me
/// create extension vector;

/// create table documents (
///   id bigserial primary key,
///   content text,
///   embedding vector (1536)
/// );

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

/// create index on documents
/// using ivfflat (embedding vector_cosine_ops)
/// with (lists = 100);

import { SupabaseClient } from "@supabase/supabase-js";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

type SupabaseMetadata = Record<string, any>;

export type SearchEmbeddingsResponse = {
  id: number;
  content: string;
  similarity: number;
};

export type SearchEmbeddingsParams = {
  query_embedding: number[];
  similarity_threshold: number; // float
  match_count: number; // int
};

export class PGVectorStore extends VectorStore {
  tableName: string;

  queryName: string;

  supabaseClient: SupabaseClient;

  constructor(
    supabaseClient: SupabaseClient,
    embeddings: Embeddings,
    tableName = "documents",
    queryName = "match_documents"
  ) {
    super(embeddings);

    this.supabaseClient = supabaseClient;
    this.embeddings = embeddings;
    this.tableName = tableName;
    this.queryName = queryName;
  }

  async addDocuments(documents: Document[], ids?: string[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      ids
    );
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    _ids?: string[]
  ): Promise<void> {
    await this.supabaseClient.from(this.tableName).upsert(
      vectors.map((embedding, idx) => ({
        content: documents[idx].pageContent,
        embedding,
      }))
    );
    // console.log(error);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const matchDocumentsParams: SearchEmbeddingsParams = {
      query_embedding: query,
      similarity_threshold: k,
      // todo pass through?
      match_count: 10,
    };

    const { data: searches } = (await this.supabaseClient.rpc(
      this.queryName,
      matchDocumentsParams
    )) as { data: SearchEmbeddingsResponse[]; error: unknown };

    // todo what to do with the error, throw?
    // console.log(error);

    const result: [Document, number][] = searches.map((resp) => [
      new Document({
        metadata: "" as unknown as SupabaseMetadata,
        pageContent: `${resp.content}`,
      }),
      resp.similarity,
    ]);

    return result;
  }

  static async fromTexts(
    supabaseClient: SupabaseClient,
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings,
    tableName = "documents",
    queryName = "match_documents"
  ): Promise<PGVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }

    return PGVectorStore.fromDocuments(
      supabaseClient,
      docs,
      embeddings,
      tableName,
      queryName
    );
  }

  static async fromDocuments(
    supabaseClient: SupabaseClient,
    docs: Document[],
    embeddings: Embeddings,
    tableName = "documents",
    queryName = "match_documents"
  ): Promise<PGVectorStore> {
    const instance = new this(supabaseClient, embeddings, tableName, queryName);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    supabaseClient: SupabaseClient,
    embeddings: Embeddings,
    tableName = "documents",
    queryName = "match_documents"
  ): Promise<PGVectorStore> {
    const instance = new this(supabaseClient, embeddings, tableName, queryName);
    return instance;
  }
}
