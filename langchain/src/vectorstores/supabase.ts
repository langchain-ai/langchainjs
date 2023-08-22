import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

/**
 * Interface for the parameters required for searching embeddings.
 */
interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
  filter?: SupabaseMetadata | SupabaseFilterRPCCall;
}

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
export type SupabaseMetadata = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
export type SupabaseFilter = PostgrestFilterBuilder<any, any, any>;
export type SupabaseFilterRPCCall = (rpcCall: SupabaseFilter) => SupabaseFilter;

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
  upsertBatchSize?: number;
}

/**
 * Class for interacting with a Supabase database to store and manage
 * vectors.
 */
export class SupabaseVectorStore extends VectorStore {
  declare FilterType: SupabaseMetadata | SupabaseFilterRPCCall;

  client: SupabaseClient;

  tableName: string;

  queryName: string;

  filter?: SupabaseMetadata | SupabaseFilterRPCCall;

  upsertBatchSize = 500;

  _vectorstoreType(): string {
    return "supabase";
  }

  constructor(embeddings: Embeddings, args: SupabaseLibArgs) {
    super(embeddings, args);

    this.client = args.client;
    this.tableName = args.tableName || "documents";
    this.queryName = args.queryName || "match_documents";
    this.filter = args.filter;
    this.upsertBatchSize = args.upsertBatchSize ?? this.upsertBatchSize;
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
  async delete(params: { ids: string[] }): Promise<void> {
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
    const matchDocumentsParams: Partial<SearchEmbeddingsParams> = {
      query_embedding: query,
    };

    let filterFunction: SupabaseFilterRPCCall;

    if (typeof _filter === "function") {
      filterFunction = (rpcCall) => _filter(rpcCall).limit(k);
    } else if (typeof _filter === "object") {
      matchDocumentsParams.filter = _filter;
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
