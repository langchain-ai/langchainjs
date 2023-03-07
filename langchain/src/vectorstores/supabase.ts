import type { SupabaseClient } from "@supabase/supabase-js";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
}

interface SearchEmbeddingsResponse {
  id: number;
  content: string;
  metadata: object;
  similarity: number;
}

export class SupabaseVectorStore extends VectorStore {
  tableName: string;

  queryName: string;

  constructor(
    public client: SupabaseClient,
    embeddings: Embeddings,
    options: {
      tableName?: string;
      queryName?: string;
      withMetadata?: boolean;
    } = {}
  ) {
    super(embeddings);

    this.tableName = options.tableName || "documents";
    this.queryName = options.queryName || "match_documents";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const rows = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    // upsert returns 500/502/504 (yes really any of them) if given too many rows/characters
    // ~2000 trips it, but my data is probably smaller than average pageContent and metadata
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const res = await this.client.from(this.tableName).insert(chunk);
      if (res.error) {
        throw new Error(
          `Error inserting: ${res.error.message} ${res.status} ${res.statusText}`
        );
      }
    }
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

    return result;
  }

  static async fromTexts(
    client: SupabaseClient,
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings
  ): Promise<SupabaseVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }
    return SupabaseVectorStore.fromDocuments(client, docs, embeddings);
  }

  static async fromDocuments(
    client: SupabaseClient,
    docs: Document[],
    embeddings: Embeddings
  ): Promise<SupabaseVectorStore> {
    const instance = new this(client, embeddings);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    client: SupabaseClient,
    embeddings: Embeddings
  ): Promise<SupabaseVectorStore> {
    const instance = new this(client, embeddings);
    return instance;
  }
}
