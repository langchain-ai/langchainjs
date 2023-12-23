import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { getEnvironmentVariable } from "../util/env.js";
import { VectorStore } from "./base.js";

interface TurbopufferIntegrationParams {
  apiKey?: string;
  namespace?: string;
}

interface TurbopufferHeaders {
  headers: {
    Authorization: string;
    "Content-Type": string;
  };
}

enum TurbopufferDistanceMetric {
  Cosine = "cosine_distance",
  Euclidean = "euclidean_squared",
}

interface TurbopufferQueryResult {
  dist: number;
  id: number;
  vector: number[];
  attributes: Record<string, string>;
}

export class TurbopufferVectorStore extends VectorStore {
  get lc_secrets(): { [key: string]: string } {
    return {
      apiKey: "Turbopuffer_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } {
    return {
      apiKey: "Turbopuffer_api_key",
    };
  }

  private apiKey: string;

  private namespace: string;

  private apiEndpoint = "https://api.Turbopuffer.com/v1/";

  public _vectorstoreType(): string {
    return "Turbopuffer";
  }

  constructor(
    embeddings: Embeddings,
    args: {
      apiKey?: string;
      namespace?: string;
    }
  ) {
    super(embeddings, args);

    const apiKey = args.apiKey ?? getEnvironmentVariable("Turbopuffer_API_KEY");
    if (!apiKey) {
      throw new Error("Turbopuffer api key is not provided.");
    }
    this.apiKey = apiKey;
    this.namespace = args.namespace ?? "default";
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
    documents: Document<Record<string, unknown>>[],
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

      await fetch(`${this.apiEndpoint}/vectors/${this.namespace}`, {
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
    documents: Document<Record<string, unknown>>[],
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
    distanceMetric: TurbopufferDistanceMetric,
    includeAttributes?: string[],
    includeVector?: boolean,
    // See https://Turbopuffer.com/docs/reference/query for more info
    filters?: Record<string, string>
  ): Promise<TurbopufferQueryResult[]> {
    const data = {
      query,
      k,
      distanceMetric,
      filters,
      includeAttributes,
      includeVector,
    };

    const response = await fetch(
      `${this.apiEndpoint}/vectors/${this.namespace}/query`,
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
    filter?: Record<string, string>
  ): Promise<[Document, number][]> {
    const search = await this.queryVectors(
      query,
      k,
      TurbopufferDistanceMetric.Cosine,
      ["source", "pageContent"],
      false,
      filter
    );

    const result: [Document, number][] = search.map((res) => [
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
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: TurbopufferIntegrationParams
  ): Promise<TurbopufferVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
