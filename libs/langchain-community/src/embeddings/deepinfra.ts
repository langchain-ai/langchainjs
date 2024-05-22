import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

/**
 * The default model name to use for generating embeddings.
 */
const DEFAULT_MODEL_NAME = "sentence-transformers/clip-ViT-B-32";

/**
 * The default batch size to use for generating embeddings.
 * This is limited by the DeepInfra API to a maximum of 1024.
 */
const DEFAULT_BATCH_SIZE = 1024;

/**
 * Environment variable name for the DeepInfra API token.
 */
const API_TOKEN_ENV_VAR = "DEEPINFRA_API_TOKEN";

export interface DeepInfraEmbeddingsRequest {
  inputs: string[];
  normalize?: boolean;
  image?: string;
  webhook?: string;
}

/**
 * Input parameters for the DeepInfra embeddings
 */
export interface DeepInfraEmbeddingsParams extends EmbeddingsParams {
  /**
   * The API token to use for authentication.
   * If not provided, it will be read from the `DEEPINFRA_API_TOKEN` environment variable.
   */
  apiToken?: string;

  /**
   * The model ID to use for generating completions.
   * Default: `sentence-transformers/clip-ViT-B-32`
   */
  modelName?: string;

  /**
   * The maximum number of texts to embed in a single request. This is
   * limited by the DeepInfra API to a maximum of 1024.
   */
  batchSize?: number;
}

/**
 * Response from the DeepInfra embeddings API.
 */
export interface DeepInfraEmbeddingsResponse {
  /**
   * The embeddings generated for the input texts.
   */
  embeddings: number[][];
  /**
   * The number of tokens in the input texts.
   */
  input_tokens: number;
  /**
   * The status of the inference.
   */
  request_id?: string;
}

/**
 * A class for generating embeddings using the DeepInfra API.
 * @example
 * ```typescript
 * // Embed a query using the DeepInfraEmbeddings class
 * const model = new DeepInfraEmbeddings();
 * const res = await model.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?",
 * );
 * console.log({ res });
 * ```
 */
export class DeepInfraEmbeddings
  extends Embeddings
  implements DeepInfraEmbeddingsParams
{
  apiToken: string;

  batchSize: number;

  modelName: string;

  /**
   * Constructor for the DeepInfraEmbeddings class.
   * @param fields - An optional object with properties to configure the instance.
   */
  constructor(
    fields?: Partial<DeepInfraEmbeddingsParams> & {
      verbose?: boolean;
    }
  ) {
    const fieldsWithDefaults = {
      modelName: DEFAULT_MODEL_NAME,
      batchSize: DEFAULT_BATCH_SIZE,
      ...fields,
    };

    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiToken || getEnvironmentVariable(API_TOKEN_ENV_VAR);

    if (!apiKey) {
      throw new Error("DeepInfra API token not found");
    }

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.apiToken = apiKey;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param inputs - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(inputs: string[]): Promise<number[][]> {
    const batches = chunkArray(inputs, this.batchSize);

    const batchRequests = batches.map((batch: string[]) =>
      this.embeddingWithRetry({
        inputs: batch,
      })
    );

    const batchResponses = await Promise.all(batchRequests);

    const out: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { embeddings } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        out.push(embeddings[j]);
      }
    }

    return out;
  }

  /**
   * Generates an embedding for a single text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { embeddings } = await this.embeddingWithRetry({
      inputs: [text],
    });
    return embeddings[0];
  }

  /**
   * Generates embeddings with retry capabilities.
   * @param request - An object containing the request parameters for generating embeddings.
   * @returns A Promise that resolves to the API response.
   */
  private async embeddingWithRetry(
    request: DeepInfraEmbeddingsRequest
  ): Promise<DeepInfraEmbeddingsResponse> {
    const response = await this.caller.call(() =>
      fetch(`https://api.deepinfra.com/v1/inference/${this.modelName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }).then((res) => res.json())
    );
    return response as DeepInfraEmbeddingsResponse;
  }
}
