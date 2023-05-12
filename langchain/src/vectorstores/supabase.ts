import type { SupabaseClient } from "@supabase/supabase-js";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
  filter?: SupabaseMetadata;
  bucket_id?: string;
}

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type SupabaseMetadata = Record<string, any>;

interface SearchEmbeddingsResponse {
  id: number;
  content: string;
  metadata: object;
  similarity: number;
}

interface SupabaseCallbacks {
  // This is used to insert data into the table when we add vectors
  // this is really useful for things like updatedAt or createdAt
  onInsert?: () => Promise<Record<string, unknown>>;
}

export interface SupabaseLibArgs {
  client: SupabaseClient;
  tableName?: string;
  queryName?: string;
  filter?: SupabaseMetadata;
  bucketId?: string;
  callbacks?: SupabaseCallbacks;
}

export class SupabaseVectorStore extends VectorStore {
  declare FilterType: SupabaseMetadata;

  client: SupabaseClient;

  tableName: string;

  queryName: string;

  filter?: SupabaseMetadata;

  bucketId?: string;

  callbacks?: SupabaseCallbacks;


  constructor(embeddings: Embeddings, args: SupabaseLibArgs) {
    super(embeddings, args);
    this.client = args.client;
    this.tableName = args.tableName || "documents";
    this.queryName = args.queryName || "match_documents";
    this.filter = args.filter;
    this.bucketId = args.bucketId;
    this.callbacks = args.callbacks;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    let extraData: Record<string, unknown> = {};

    // This makes it so that we are backwards compatible with the old sql functions that don't have the bucket_id column
    if (this.bucketId) {
      extraData = { bucketId: this.bucketId };
    }

    // If the user has provided a callback, we will call it and add the data to the extraData
    if (this.callbacks?.onInsert) {
      const insertData = await this.callbacks.onInsert();
      extraData = { ...extraData, ...insertData };
    }

    const rows = vectors.map((embedding, idx) => {
      const returnData = {
        content: documents[idx].pageContent,
        embedding,
        metadata: documents[idx].metadata,
        ...extraData,
      }
      return returnData;
    });

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
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }
    const _filter = filter ?? this.filter;
    const matchDocumentsParams: SearchEmbeddingsParams = {
      filter: _filter,
      query_embedding: query,
      match_count: k,
      bucket_id: this.bucketId,
    };

    const { data: searches, error } = await this.client.rpc(
      this.queryName,
      matchDocumentsParams
    );

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

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: SupabaseLibArgs
  ): Promise<SupabaseVectorStore> {
    const docs = [];
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

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: SupabaseLibArgs
  ): Promise<SupabaseVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: SupabaseLibArgs
  ): Promise<SupabaseVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
