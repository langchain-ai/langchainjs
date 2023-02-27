import { SupabaseClient } from '@supabase/supabase-js';
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type SupabaseMetadata = Record<string, any>;

export type SearchEmbeddingsResponse = {
    id: number
    prompt: string
    completion: string
    similarity: number
    token_count: number
  }

  export type SearchEmbeddingsParams = {
    query_embedding: number[]
    match_threshold: number // float
    match_count: number // int
  }
  
  
export class PGVectorStore extends VectorStore {
  textKey: string;

  supabaseClient: SupabaseClient;

  constructor(
    supabaseClient: SupabaseClient,
    embeddings: Embeddings,
    textKey = "text"
  ) {
    super(embeddings);

    this.supabaseClient = supabaseClient;
    this.embeddings = embeddings;
    this.textKey = textKey;
  }

  async addDocuments(_documents: Document[], _ids?: string[]): Promise<void> {
    return new Promise((resolve) => {
        resolve();
      });
  }

  async addVectors(
    _vectors: number[][],
    _documents: Document[],
    _ids?: string[]
  ): Promise<void> {
    return new Promise((resolve) => {
        resolve();
      });
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const matchDocumentsParams: SearchEmbeddingsParams = {
      query_embedding: query,
      match_threshold: k,
      match_count: 100,
    };

    const { searches } = (await this.supabaseClient.rpc(
      this.textKey,
      matchDocumentsParams
    )) as unknown as { searches: SearchEmbeddingsResponse[]; error: unknown };

    const result: [Document, number][] = [];

    searches.forEach(resp => result.push([new Document({ metadata: "" as unknown as SupabaseMetadata, pageContent: `${resp.prompt  } ${  resp.completion}` }), resp.similarity]));

    return result;
  }

  static async fromTexts(
    supabaseClient: SupabaseClient,
    _texts: string[],
    _metadatas: object[],
    embeddings: Embeddings,
    textKey = "text"
  ): Promise<PGVectorStore> {
    return new PGVectorStore(supabaseClient, embeddings, textKey);
  }

  static async fromDocuments(
    supabaseClient: SupabaseClient,
    _docs: Document[],
    embeddings: Embeddings,
    textKey = "text"
  ): Promise<PGVectorStore> {
    return new PGVectorStore(supabaseClient, embeddings, textKey);
  }

  static async fromExistingIndex(
    pineconeClient: SupabaseClient,
    embeddings: Embeddings,
    textKey = "text"
  ): Promise<PGVectorStore> {
    const instance = new this(pineconeClient, embeddings, textKey);
    return instance;
  }
}
