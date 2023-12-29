import { type DocumentInterface, Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  AsyncCaller,
  AsyncCallerParams
} from "@langchain/core/utils/async_caller";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { VectorStore } from "@langchain/core/vectorstores";

export interface TurbopufferHeaders {
  headers: {
    Authorization: string;
    "Content-Type": string;
  };
}

export type TurbopufferDistanceMetric = "cosine_distance" | "euclidean_squared";

export type TurbopufferFilterType = Record<string, Array<[string, string[] | string]>>;

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
      apiKey: "TURBOPUFFER_API_KEY"
    };
  }

  get lc_aliases(): { [key: string]: string } {
    return {
      apiKey: "TURBOPUFFER_API_KEY"
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

  batchSize = 500;

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
      ...asyncCallerArgs
    });
  }

  getJsonHeader(): TurbopufferHeaders {
    return {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      }
    };
  }

  async callWithRetry(fetchUrl: string, stringifiedBody: string) {
    const response = await this.caller.call(async () =>
      fetch(fetchUrl, {
        method: "POST",
        headers: this.getJsonHeader().headers,
        body: stringifiedBody
      })
    );
    return response;
  }

  async addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: { ids?: number[] }
  ): Promise<void> {
    try {
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

      const batchedVectors = chunkArray(vectors, this.batchSize);
      const batchedDocuments = chunkArray(documents, this.batchSize);
      const batchedIds = options?.ids
        ? chunkArray(options.ids, this.batchSize)
        : batchedDocuments.map((docs, index) =>
            docs.map((_, docIndex) => index * this.batchSize + docIndex)
          );

      const batchRequests = batchedVectors.map(async (batchVectors, index) => {
        const batchDocs = batchedDocuments[index];
        const batchIds = batchedIds[index];

        if (batchIds.length !== batchVectors.length) {
          throw new Error(
            "Number of ids provided does not match number of vectors"
          );
        }

        const attributes = {
          pageContent: batchDocs.map((doc) => doc.pageContent),
          metadata: batchDocs.map((doc) => JSON.stringify(doc.metadata ?? {}))
        };

        const data = {
          ids: batchIds,
          vectors: batchVectors,
          attributes
        };

        const response = await this.callWithRetry(
          `${this.apiUrl}/vectors/${this.namespace}`,
          JSON.stringify(data)
        );

        if (response.status !== 200) {
          throw new Error(
            `Failed to add vectors to Turbopuffer. Response status ${
              response.status
            }\nFull response: ${await response.text()}`
          );
        }
      });

      // Execute all batch requests in parallel
      await Promise.all(batchRequests);
    } catch (error) {
      console.error("Error storing vectors:", error);
      throw error;
    }
  }

  async addDocuments(
    documents: DocumentInterface[],
    options?: { ids?: number[] }
  ): Promise<void> {
    const vectors = await this.embeddings.embedDocuments(
      documents.map((doc) => doc.pageContent)
    );

    return this.addVectors(vectors, documents, options);
  }

  async queryVectors(
    query: number[],
    k: number,
    includeAttributes?: string[],
    includeVector?: boolean,
    // See https://Turbopuffer.com/docs/reference/query for more info
    filter?: TurbopufferFilterType
  ): Promise<TurbopufferQueryResult[]> {
    const data = {
      vector: query,
      top_k: k,
      distance_metric: this.distanceMetric,
      filters: filter,
      include_attributes: includeAttributes,
      include_vectors: includeVector
    };

    const response = await this.callWithRetry(
      `${this.apiUrl}/vectors/${this.namespace}/query`,
      JSON.stringify(data)
    );
    if (response.status !== 200) {
      throw new Error(
        `Failed to query vectors from Turbopuffer. Response status ${
          response.status
        }\nFull response: ${await response.text()}`
      );
    }

    const json = await response.json();
    console.log(json);
    return json;
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[DocumentInterface, number][]> {
    const includeAttributes = ["pageContent", "metadata"];
    const search = await this.queryVectors(
      query,
      k,
      includeAttributes,
      false,
      filter
    );
    console.log("search", JSON.stringify(search, null, 2));
    const result: [DocumentInterface, number][] = search.map((res) => [
      new Document({
        pageContent: res.attributes.pageContent,
        metadata: res.attributes.metadata
          ? JSON.parse(res.attributes.metadata)
          : undefined
      }),
      res.dist
    ]);

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
