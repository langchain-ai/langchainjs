import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the FireworksEmbeddings class.
 */
export interface FireworksEmbeddingsParams extends EmbeddingsParams {
  /**
   * @deprecated Use `model` instead.
   */
  modelName: string;

  /**
   * Model name to use.
   */
  model: string;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the Fireworks AI API to a maximum of 8.
   */
  batchSize?: number;
}

/**
 * Interface for the request body to generate embeddings.
 */
export interface CreateFireworksEmbeddingRequest {
  /**
   * @type {string}
   * @memberof CreateFireworksEmbeddingRequest
   */
  model: string;

  /**
   *  Text to generate vector expectation
   * @type {CreateEmbeddingRequestInput}
   * @memberof CreateFireworksEmbeddingRequest
   */
  input: string | string[];
}

/**
 * A class for generating embeddings using the Fireworks AI API.
 */
export class FireworksEmbeddings
  extends Embeddings
  implements FireworksEmbeddingsParams
{
  /**
   * @deprecated Use `model` instead.
   */
  modelName = "nomic-ai/nomic-embed-text-v1.5";

  model = "nomic-ai/nomic-embed-text-v1.5";

  batchSize = 8;

  private apiKey: string;

  basePath?: string = "https://api.fireworks.ai/inference/v1";

  apiUrl: string;

  headers?: Record<string, string>;

  /**
   * Constructor for the FireworksEmbeddings class.
   * @param fields - An optional object with properties to configure the instance.
   */
  constructor(
    fields?: Partial<FireworksEmbeddingsParams> & {
      verbose?: boolean;
      apiKey?: string;
    }
  ) {
    const fieldsWithDefaults = { ...fields };

    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiKey || getEnvironmentVariable("FIREWORKS_API_KEY");

    if (!apiKey) {
      throw new Error("Fireworks AI API key not found");
    }

    this.model = fieldsWithDefaults?.model ?? this.model;
    this.modelName = this.model;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.apiKey = apiKey;
    this.apiUrl = `${this.basePath}/embeddings`;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(texts, this.batchSize);

    const batchRequests = batches.map((batch) =>
      this.embeddingWithRetry({
        model: this.model,
        input: batch,
      })
    );

    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { data: batchResponse } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        embeddings.push(batchResponse[j].embedding);
      }
    }

    return embeddings;
  }

  /**
   * Generates an embedding for a single text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry({
      model: this.model,
      input: text,
    });

    return data[0].embedding;
  }

  /**
   * Makes a request to the Fireworks AI API to generate embeddings for an array of texts.
   * @param request - An object with properties to configure the request.
   * @returns A Promise that resolves to the response from the Fireworks AI API.
   */

  private async embeddingWithRetry(request: CreateFireworksEmbeddingRequest) {
    const makeCompletionRequest = async () => {
      const url = `${this.apiUrl}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.headers,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const { error: message } = await response.json();
        const error = new Error(
          `Error ${response.status}: ${message ?? "Unspecified error"}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).response = response;
        throw error;
      }

      const json = await response.json();
      return json;
    };

    return this.caller.call(makeCompletionRequest);
  }
}
