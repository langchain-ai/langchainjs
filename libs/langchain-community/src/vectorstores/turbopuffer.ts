import { v4 as uuidv4 } from "uuid";
import { type DocumentInterface, Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { VectorStore } from "@langchain/core/vectorstores";

export type TurbopufferDistanceMetric = "cosine_distance" | "euclidean_squared";

export type TurbopufferFilterType = Record<
  string,
  Array<[string, string[] | string]>
>;

export interface TurbopufferParams extends AsyncCallerParams {
  apiKey?: string;
  namespace?: string;
  distanceMetric?: TurbopufferDistanceMetric;
  apiUrl?: string;
  batchSize?: number;
}

export interface TurbopufferQueryResult {
  dist: number;
  id: number;
  vector?: number[];
  attributes: Record<string, string>;
}

export class TurbopufferVectorStore extends VectorStore {
  declare FilterType: TurbopufferFilterType;

  get lc_secrets(): { [key: string]: string } {
    return {
      apiKey: "TURBOPUFFER_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } {
    return {
      apiKey: "TURBOPUFFER_API_KEY",
    };
  }

  // Handle minification for tracing
  static lc_name(): string {
    return "TurbopufferVectorStore";
  }

  protected distanceMetric: TurbopufferDistanceMetric = "cosine_distance";

  protected apiKey: string;

  protected namespace = "default";

  protected apiUrl = "https://api.turbopuffer.com/v1";

  caller: AsyncCaller;

  batchSize = 3000;

  public _vectorstoreType(): string {
    return "turbopuffer";
  }

  constructor(embeddings: EmbeddingsInterface, args: TurbopufferParams) {
    super(embeddings, args);

    const {
      apiKey: argsApiKey,
      namespace,
      distanceMetric,
      apiUrl,
      batchSize,
      ...asyncCallerArgs
    } = args;

    const apiKey = argsApiKey ?? getEnvironmentVariable("TURBOPUFFER_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Turbopuffer API key not found.\nPlease pass it in as "apiKey" or set it as an environment variable called "TURBOPUFFER_API_KEY"`
      );
    }
    this.apiKey = apiKey;
    this.namespace = namespace ?? this.namespace;
    this.distanceMetric = distanceMetric ?? this.distanceMetric;
    this.apiUrl = apiUrl ?? this.apiUrl;
    this.batchSize = batchSize ?? this.batchSize;
    this.caller = new AsyncCaller({
      maxConcurrency: 6,
      maxRetries: 0,
      ...asyncCallerArgs,
    });
  }

  defaultHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async callWithRetry(
    fetchUrl: string,
    stringifiedBody: string | undefined,
    method = "POST"
  ) {
    const json = await this.caller.call(async () => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
      };
      if (stringifiedBody !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      const response = await fetch(fetchUrl, {
        method,
        headers,
        body: stringifiedBody,
      });
      if (response.status !== 200) {
        const error = new Error(
          `Failed to call turbopuffer. Response status ${
            response.status
          }\nFull response: ${await response.text()}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).response = response;
        throw error;
      }
      return response.json();
    });

    return json;
  }

  async addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    if (options?.ids && options.ids.length !== vectors.length) {
      throw new Error(
        "Number of ids provided does not match number of vectors"
      );
    }

    if (documents.length !== vectors.length) {
      throw new Error(
        "Number of documents provided does not match number of vectors"
      );
    }

    if (documents.length === 0) {
      throw new Error("No documents provided");
    }

    const batchedVectors: number[][][] = chunkArray(vectors, this.batchSize);
    const batchedDocuments: DocumentInterface[][] = chunkArray(
      documents,
      this.batchSize
    );
    const batchedIds = options?.ids
      ? chunkArray(options.ids, this.batchSize)
      : batchedDocuments.map((docs) => docs.map((_) => uuidv4()));

    const batchRequests = batchedVectors.map(async (batchVectors, index) => {
      const batchDocs = batchedDocuments[index];
      const batchIds = batchedIds[index];

      if (batchIds.length !== batchVectors.length) {
        throw new Error(
          "Number of ids provided does not match number of vectors"
        );
      }

      const attributes: Record<string, (string | null)[]> = {
        __lc_page_content: batchDocs.map((doc) => doc.pageContent),
      };

      const usedMetadataFields = new Set(
        batchDocs.map((doc) => Object.keys(doc.metadata)).flat()
      );

      for (const key of usedMetadataFields) {
        attributes[key] = batchDocs.map((doc) => {
          if (doc.metadata[key] !== undefined) {
            if (typeof doc.metadata[key] === "string") {
              return doc.metadata[key];
            } else {
              console.warn(
                [
                  `[WARNING]: Dropping non-string metadata key "${key}" with value "${JSON.stringify(
                    doc.metadata[key]
                  )}".`,
                  `turbopuffer currently supports only string metadata values.`,
                ].join("\n")
              );
              return null;
            }
          } else {
            return null;
          }
        });
      }

      const data = {
        ids: batchIds,
        vectors: batchVectors,
        distance_metric: this.distanceMetric,
        attributes,
      };

      return this.callWithRetry(
        `${this.apiUrl}/vectors/${this.namespace}`,
        JSON.stringify(data)
      );
    });

    // Execute all batch requests in parallel
    await Promise.all(batchRequests);
    return batchedIds.flat();
  }

  async delete(params: { deleteIndex?: boolean }): Promise<void> {
    if (params.deleteIndex) {
      await this.callWithRetry(
        `${this.apiUrl}/vectors/${this.namespace}`,
        undefined,
        "DELETE"
      );
    } else {
      throw new Error(`You must provide a "deleteIndex" flag.`);
    }
  }

  async addDocuments(
    documents: DocumentInterface[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    const vectors = await this.embeddings.embedDocuments(
      documents.map((doc) => doc.pageContent)
    );

    return this.addVectors(vectors, documents, options);
  }

  protected async queryVectors(
    query: number[],
    k: number,
    includeVector?: boolean,
    // See https://Turbopuffer.com/docs/reference/query for more info
    filter?: this["FilterType"]
  ): Promise<TurbopufferQueryResult[]> {
    const data = {
      vector: query,
      top_k: k,
      distance_metric: this.distanceMetric,
      filters: filter,
      include_attributes: true,
      include_vectors: includeVector,
    };

    return this.callWithRetry(
      `${this.apiUrl}/vectors/${this.namespace}/query`,
      JSON.stringify(data)
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[DocumentInterface, number][]> {
    const search = await this.queryVectors(query, k, false, filter);
    const result: [DocumentInterface, number][] = search.map((res) => {
      const { __lc_page_content, ...metadata } = res.attributes;
      return [
        new Document({
          pageContent: __lc_page_content,
          metadata,
        }),
        res.dist,
      ];
    });

    return result;
  }

  static async fromDocuments(
    docs: DocumentInterface[],
    embeddings: EmbeddingsInterface,
    dbConfig: TurbopufferParams
  ): Promise<TurbopufferVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
