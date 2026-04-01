import { type EmbeddingsParams, Embeddings } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
const DEFAULT_FIREWORKS_EMBEDDING_MODEL = "nomic-ai/nomic-embed-text-v1.5";

export interface FireworksEmbeddingsParams extends EmbeddingsParams {
  /**
   * The Fireworks API key to use.
   */
  apiKey?: string;

  /**
   * The model name to use.
   * @default "nomic-ai/nomic-embed-text-v1.5"
   */
  model?: string;

  /**
   * The maximum number of documents to embed in a single request.
   * Fireworks currently limits this to 8.
   * @default 8
   */
  batchSize?: number;

  /**
   * Override the Fireworks base URL.
   * @default "https://api.fireworks.ai/inference/v1"
   */
  basePath?: string;

  /**
   * Additional headers to include with embedding requests.
   */
  headers?: Record<string, string>;
}

export interface CreateFireworksEmbeddingRequest {
  model: string;
  input: string | string[];
}

interface FireworksEmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

/**
 * Fireworks embeddings integration.
 *
 * Setup:
 *
 * ```bash
 * npm install @langchain/fireworks @langchain/core
 * export FIREWORKS_API_KEY="your-api-key"
 * ```
 *
 * @example
 * ```typescript
 * import { FireworksEmbeddings } from "@langchain/fireworks";
 *
 * const embeddings = new FireworksEmbeddings();
 * const vector = await embeddings.embedQuery("hello world");
 * ```
 */
export class FireworksEmbeddings
  extends Embeddings
  implements FireworksEmbeddingsParams
{
  static lc_name() {
    return "FireworksEmbeddings";
  }

  lc_namespace = ["langchain", "embeddings", "fireworks"];

  lc_serializable = true;

  model = DEFAULT_FIREWORKS_EMBEDDING_MODEL;

  batchSize = 8;

  apiKey: string;

  basePath = FIREWORKS_BASE_URL;

  apiUrl: string;

  headers?: Record<string, string>;

  constructor(fields?: Partial<FireworksEmbeddingsParams>) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("FIREWORKS_API_KEY");
    if (!apiKey) {
      throw new Error(
        'Fireworks API key not found. Please set the FIREWORKS_API_KEY environment variable or pass the key into "apiKey".'
      );
    }

    this.apiKey = apiKey;
    this.model = fields?.model ?? this.model;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.basePath = fields?.basePath ?? this.basePath;
    this.apiUrl = `${this.basePath}/embeddings`;
    this.headers = fields?.headers;
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "FIREWORKS_API_KEY",
    };
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(texts, this.batchSize);
    const batchResponses = await Promise.all(
      batches.map((batch) =>
        this.embeddingWithRetry({
          model: this.model,
          input: batch,
        })
      )
    );

    const embeddings: number[][] = [];
    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { data } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        embeddings.push(data[j].embedding);
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry({
      model: this.model,
      input: text,
    });
    return data[0].embedding;
  }

  private async embeddingWithRetry(
    request: CreateFireworksEmbeddingRequest
  ): Promise<FireworksEmbeddingResponse> {
    return this.caller.call(async () => {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.headers,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(
          `Error ${response.status}: ${body.error ?? "Unspecified error"}`
        );
      }

      return (await response.json()) as FireworksEmbeddingResponse;
    });
  }
}
