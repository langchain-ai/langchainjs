import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

import { MixedbreadAIClient, MixedbreadAI } from "@mixedbread-ai/sdk";

type EmbeddingsRequestWithoutInput = Omit<
  MixedbreadAI.EmbeddingsRequest,
  "input"
>;

/**
 * Interface extending EmbeddingsParams with additional
 * parameters specific to the MixedbreadAIEmbeddings class.
 */
export interface MixedbreadAIEmbeddingsParams
  extends EmbeddingsParams,
    Omit<EmbeddingsRequestWithoutInput, "model"> {
  /**
   * The model to use for generating embeddings.
   * @default {"mixedbread-ai/mxbai-embed-large-v1"}
   */
  model?: string;

  /**
   * The maximum number of documents to embed in a single request.
   * @default {128}
   */
  batchSize?: number;

  /**
   * The API key to use.
   * @default {process.env.MXBAI_API_KEY}
   */
  apiKey?: string;

  /**
   * The base URL for the API.
   */
  baseUrl?: string;
}

/**
 * Class for generating embeddings using the Mixedbread AI API.
 *
 * This class leverages the model "mixedbread-ai/mxbai-embed-large-v1" to generate
 * embeddings for text documents. The embeddings can be used for various NLP tasks
 * such as similarity comparison, clustering, or as features in machine learning models.
 *
 * @example
 * const embeddings = new MixedbreadAIEmbeddings({ apiKey: 'your-api-key' });
 * const texts = ["Baking bread is fun", "I love baking"];
 * const result = await embeddings.embedDocuments(texts);
 * console.log(result);
 *
 * @example
 * const embeddings = new MixedbreadAIEmbeddings({
 *  apiKey: 'your-api-key',
 *  model: 'mixedbread-ai/mxbai-embed-large-v1',
 *  encodingFormat: MixedbreadAI.EncodingFormat.Binary,
 *  dimensions: 512,
 *  normalized: true,
 * });
 * const texts = ["Baking bread is fun", "I love baking"];
 * const result = await embeddings.embedDocuments(texts);
 * console.log(result);
 */
export class MixedbreadAIEmbeddings extends Embeddings {
  lc_secrets = {
    apiKey: "MXBAI_API_KEY",
  };

  requestParams: EmbeddingsRequestWithoutInput;

  batchSize: number;

  private client: MixedbreadAIClient;

  /**
   * Constructor for MixedbreadAIEmbeddings.
   * @param {Partial<MixedbreadAIEmbeddingsParams>} params - An optional object with properties to configure the instance.
   * @throws {Error} If the API key is not provided or found in the environment variables.
   * @throws {Error} If the batch size exceeds 256.
   *
   * @example
   * const embeddings = new MixedbreadAIEmbeddings({
   *     apiKey: 'your-api-key',
   *     model: 'mixedbread-ai/mxbai-embed-large-v1',
   *     batchSize: 64
   * });
   */
  constructor(params?: Partial<MixedbreadAIEmbeddingsParams>) {
    super({ maxConcurrency: 2, ...(params ?? {}) });

    const apiKey = params?.apiKey ?? getEnvironmentVariable("MXBAI_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Mixedbread AI API key not found. Either provide it in the constructor or set the 'MXBAI_API_KEY' environment variable."
      );
    }
    if (params?.batchSize && params?.batchSize > 256) {
      throw new Error(
        "The maximum batch size for Mixedbread AI embeddings API is 256."
      );
    }

    this.batchSize = params?.batchSize ?? 128;
    this.requestParams = {
      model: params?.model ?? "mixedbread-ai/mxbai-embed-large-v1",
      normalized: params?.normalized,
      dimensions: params?.dimensions,
      encodingFormat: params?.encodingFormat,
      truncationStrategy: params?.truncationStrategy,
      prompt: params?.prompt,
    };
    this.client = new MixedbreadAIClient({
      apiKey,
      environment: params?.baseUrl,
    });
  }

  /**
   * Generates embeddings for an array of texts.
   * @param {string[]} texts - An array of strings to generate embeddings for.
   * @returns {Promise<number[][]>} A Promise that resolves to an array of embeddings.
   *
   * @example
   * const embeddings = new MixedbreadAIEmbeddings({ apiKey: 'your-api-key' });
   * const texts = ["Baking bread is fun", "I love baking"];
   * const result = await embeddings.embedDocuments(texts);
   * console.log(result);
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const batches = chunkArray(texts, this.batchSize);
    const batchRequests = batches.map((batch) =>
      this.createEmbeddingsWithRetry(batch)
    );

    const batchResponses = await Promise.all(batchRequests);
    return batchResponses.flat();
  }

  /**
   * Generates an embedding for a single text.
   * @param {string} text - A string to generate an embedding for.
   * @returns {Promise<number[]>} A Promise that resolves to an array of numbers representing the embedding.
   *
   * @example
   * const embeddings = new MixedbreadAIEmbeddings({ apiKey: 'your-api-key' });
   * const text = "Represent this sentence for searching relevant passages: Is baking bread fun?";
   * const result = await embeddings.embedQuery(text);
   * console.log(result);
   */
  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.createEmbeddingsWithRetry(text);
    return embedding;
  }

  /**
   * Private method to make a request to the Mixedbread AI API to generate embeddings. Handles retry logic.
   * @param {string | string[]} input - A string or an array of strings to generate embeddings for.
   * @returns {Promise<number[][]>} A Promise that resolves to the API response.
   */
  private async createEmbeddingsWithRetry(
    input: string | string[]
  ): Promise<number[][]> {
    return this.caller.call(async () => {
      const response = await this.client.embeddings({
        ...this.requestParams,
        input,
      });
      return response.data.map((d) => d.embedding as number[]);
    });
  }
}
