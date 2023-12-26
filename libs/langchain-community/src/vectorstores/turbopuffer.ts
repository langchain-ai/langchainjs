import { type DocumentInterface, Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { VectorStore } from "@langchain/core/vectorstores";

export interface TurbopufferHeaders {
  headers: {
    Authorization: string;
    "Content-Type": string;
  };
}

export type TurbopufferDistanceMetric = "cosine_distance" | "euclidean_squared";

export type TurbopufferFilterType = Record<string, string>;

export interface TurbopufferParams {
  apiKey?: string;
  namespace?: string;
  distanceMetric?: TurbopufferDistanceMetric;
  apiUrl?: string;
}

export interface TurbopufferQueryResult {
  dist: number;
  id: number;
  vector: number[];
  attributes: TurbopufferFilterType;
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

  protected apiUrl = "https://api.turbopuffer.com/v1/";

  public _vectorstoreType(): string {
    return "turbopuffer";
  }

  constructor(embeddings: EmbeddingsInterface, args: TurbopufferParams) {
    super(embeddings, args);

    const apiKey = args.apiKey ?? getEnvironmentVariable("TURBOPUFFER_API_KEY");
    if (!apiKey) {
      throw new Error(
        [
          "Turbopuffer API key not found.",
          `Please pass it in as "apiKey" or set it as an environment variable called "TURBOPUFFER_API_KEY"`,
        ].join("\n")
      );
    }
    this.apiKey = apiKey;
    this.namespace = args.namespace ?? this.namespace;
    this.distanceMetric = args.distanceMetric ?? this.distanceMetric;
    this.apiUrl = args.apiUrl ?? this.apiUrl;
  }

  getJsonHeader(): TurbopufferHeaders {
    return {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    };
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

      const docIds = options?.ids ?? documents.map((_, index) => index);

      const attributes = {
        source: documents.map((doc) => doc.metadata.source),
        pageContent: documents.map((doc) => doc.pageContent),
      };

      const data = {
        docIds,
        vectors,
        attributes,
      };

      await fetch(`${this.apiUrl}/vectors/${this.namespace}`, {
        method: "POST",
        headers: this.getJsonHeader().headers,
        body: JSON.stringify(data),
      });
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
      query,
      k,
      distanceMetric: this.distanceMetric,
      filters: filter,
      includeAttributes,
      includeVector,
    };

    const response = await fetch(
      `${this.apiUrl}/vectors/${this.namespace}/query`,
      {
        method: "POST",
        headers: this.getJsonHeader().headers,
        body: JSON.stringify(data),
      }
    );

    const json = await response.json();

    return json.results;
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[DocumentInterface, number][]> {
    const search = await this.queryVectors(
      query,
      k,
      ["source", "pageContent"],
      false,
      filter
    );

    const result: [DocumentInterface, number][] = search.map((res) => [
      new Document({
        pageContent: res.attributes.pageContent,
        metadata: {
          source: res.attributes.source,
        },
      }),
      res.dist,
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
