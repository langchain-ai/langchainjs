import { v4 as uuid } from "uuid";
import { Document, type DocumentInterface } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { VectorStore } from "@langchain/core/vectorstores";
import type {
  Namespace,
  DistanceMetric,
  Row,
  NamespaceQueryResponse,
} from "@turbopuffer/turbopuffer/resources";
import type { Filter } from "@turbopuffer/turbopuffer/resources/custom";

export type { Filter as TurbopufferFilter } from "@turbopuffer/turbopuffer/resources/custom";
export type { DistanceMetric as TurbopufferDistanceMetric } from "@turbopuffer/turbopuffer/resources";

const PAGE_CONTENT_KEY = "__lc_page_content";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ColumnData = Record<string, any[]>;

/**
 * Configuration for TurbopufferVectorStore.
 */
export interface TurbopufferParams {
  /** A configured turbopuffer Namespace instance. */
  namespace: Namespace;
  /** Distance metric for similarity. Defaults to "cosine_distance". */
  distanceMetric?: DistanceMetric;
}

/**
 * Options for addDocuments and addVectors.
 */
export interface TurbopufferAddDocumentOptions {
  /** Custom IDs for the documents. */
  ids?: string[];
  /** Batch size for upsert operations. Defaults to 3000. */
  batchSize?: number;
}

/**
 * Parameters for delete operations.
 */
export interface TurbopufferDeleteParams {
  /** IDs of documents to delete. */
  ids?: string[];
  /** Delete all documents in the namespace. */
  deleteAll?: boolean;
}

/**
 * Vector store implementation using turbopuffer.
 */
export class TurbopufferVectorStore extends VectorStore {
  declare FilterType: Filter;

  get lc_secrets(): { [key: string]: string } {
    return { apiKey: "TURBOPUFFER_API_KEY" };
  }

  namespace: Namespace;

  distanceMetric: DistanceMetric;

  _vectorstoreType(): string {
    return "turbopuffer";
  }

  constructor(embeddings: EmbeddingsInterface, params: TurbopufferParams) {
    super(embeddings, params);
    this.namespace = params.namespace;
    this.distanceMetric = params.distanceMetric ?? "cosine_distance";
  }

  /**
   * Add vectors and their associated documents to the store.
   */
  async addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: TurbopufferAddDocumentOptions
  ): Promise<string[]> {
    if (documents.length === 0) return [];
    if (documents.length !== vectors.length) {
      throw new Error("Documents and vectors must have equal length");
    }
    if (options?.ids && options.ids.length !== vectors.length) {
      throw new Error("IDs array must match vectors length");
    }

    const ids = options?.ids ?? documents.map(() => uuid());
    const batchSize = options?.batchSize ?? 3000;
    const batches = this.prepareBatches(ids, vectors, documents, batchSize);

    for (const batch of batches) {
      await this.namespace.write({
        upsert_columns: batch,
        distance_metric: this.distanceMetric,
      });
    }

    return ids;
  }

  private prepareBatches(
    ids: string[],
    vectors: number[][],
    documents: DocumentInterface[],
    batchSize: number
  ): ColumnData[] {
    const batchedIds = chunkArray(ids, batchSize);
    const batchedVectors = chunkArray(vectors, batchSize);
    const batchedDocs = chunkArray(documents, batchSize);

    return batchedIds.map((batchIds, i) => {
      const batchVectors = batchedVectors[i];
      const batchDocs = batchedDocs[i];

      const columns: ColumnData = {
        id: batchIds,
        vector: batchVectors,
        [PAGE_CONTENT_KEY]: batchDocs.map((d) => d.pageContent),
      };

      const metadataKeys = new Set(
        batchDocs.flatMap((d) => Object.keys(d.metadata))
      );

      for (const key of metadataKeys) {
        columns[key] = batchDocs.map((d) => d.metadata[key] ?? null);
      }

      return columns;
    });
  }

  /**
   * Add documents to the store.
   */
  async addDocuments(
    documents: DocumentInterface[],
    options?: TurbopufferAddDocumentOptions
  ): Promise<string[]> {
    const vectors = await this.embeddings.embedDocuments(
      documents.map((d) => d.pageContent)
    );
    return this.addVectors(vectors, documents, options);
  }

  /**
   * Delete documents by ID or delete all documents in the namespace.
   */
  async delete(params: TurbopufferDeleteParams): Promise<void> {
    if (params.deleteAll) {
      await this.namespace.deleteAll();
      return;
    }
    if (params.ids?.length) {
      await this.namespace.write({ deletes: params.ids });
      return;
    }
    throw new Error("Either ids or deleteAll must be provided.");
  }

  /**
   * Search for documents similar to the query vector.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: Filter
  ): Promise<[DocumentInterface, number][]> {
    let response: NamespaceQueryResponse;
    try {
      response = await this.namespace.query({
        rank_by: ["vector", "ANN", query],
        top_k: k,
        distance_metric: this.distanceMetric,
        include_attributes: true,
        ...(filter && { filters: filter }),
      });
    } catch (e) {
      // Namespace not found (empty or deleted) returns empty results
      const message = (e as Error)?.message ?? String(e);
      if (message.includes("404")) {
        return [];
      }
      throw e;
    }

    return (response.rows ?? []).map((row) => this.rowToDocument(row));
  }

  private rowToDocument(row: Row): [DocumentInterface, number] {
    const {
      id,
      vector: _vector,
      $dist,
      [PAGE_CONTENT_KEY]: pageContent,
      ...metadata
    } = row;

    return [
      new Document({
        id: String(id),
        pageContent: typeof pageContent === "string" ? pageContent : "",
        metadata,
      }),
      $dist ?? 0,
    ];
  }

  /**
   * Create a TurbopufferVectorStore from documents.
   */
  static async fromDocuments(
    docs: DocumentInterface[],
    embeddings: EmbeddingsInterface,
    params: TurbopufferParams
  ): Promise<TurbopufferVectorStore> {
    const store = new this(embeddings, params);
    await store.addDocuments(docs);
    return store;
  }

  /**
   * Create a TurbopufferVectorStore from text strings.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    params: TurbopufferParams
  ): Promise<TurbopufferVectorStore> {
    const docs = texts.map(
      (text, i) =>
        new Document({
          pageContent: text,
          metadata: Array.isArray(metadatas) ? metadatas[i] : metadatas,
        })
    );
    return this.fromDocuments(docs, embeddings, params);
  }
}
