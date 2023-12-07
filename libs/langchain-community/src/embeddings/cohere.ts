import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "../utils/chunk.js";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the CohereEmbeddings class.
 */
export interface CohereEmbeddingsParams extends EmbeddingsParams {
  modelName: string;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the Cohere API to a maximum of 96.
   */
  batchSize?: number;
}

/**
 * A class for generating embeddings using the Cohere API.
 * @example
 * ```typescript
 * // Embed a query using the CohereEmbeddings class
 * const model = new ChatOpenAI();
 * const res = await model.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?",
 * );
 * console.log({ res });
 *
 * ```
 */
export class CohereEmbeddings
  extends Embeddings
  implements CohereEmbeddingsParams
{
  modelName = "small";

  batchSize = 48;

  private apiKey: string;

  private client: typeof import("cohere-ai");

  /**
   * Constructor for the CohereEmbeddings class.
   * @param fields - An optional object with properties to configure the instance.
   */
  constructor(
    fields?: Partial<CohereEmbeddingsParams> & {
      verbose?: boolean;
      apiKey?: string;
    }
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiKey || getEnvironmentVariable("COHERE_API_KEY");

    if (!apiKey) {
      throw new Error("Cohere API key not found");
    }

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.apiKey = apiKey;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    await this.maybeInitClient();

    const batches = chunkArray(texts, this.batchSize);

    const batchRequests = batches.map((batch) =>
      this.embeddingWithRetry({
        model: this.modelName,
        texts: batch,
      })
    );

    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { body: batchResponse } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        embeddings.push(batchResponse.embeddings[j]);
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
    await this.maybeInitClient();

    const { body } = await this.embeddingWithRetry({
      model: this.modelName,
      texts: [text],
    });
    return body.embeddings[0];
  }

  /**
   * Generates embeddings with retry capabilities.
   * @param request - An object containing the request parameters for generating embeddings.
   * @returns A Promise that resolves to the API response.
   */
  private async embeddingWithRetry(
    request: Parameters<typeof this.client.embed>[0]
  ) {
    await this.maybeInitClient();

    return this.caller.call(this.client.embed.bind(this.client), request);
  }

  /**
   * Initializes the Cohere client if it hasn't been initialized already.
   */
  private async maybeInitClient() {
    if (!this.client) {
      const { cohere } = await CohereEmbeddings.imports();

      this.client = cohere;
      this.client.init(this.apiKey);
    }
  }

  /** @ignore */
  static async imports(): Promise<{
    cohere: typeof import("cohere-ai");
  }> {
    try {
      const { default: cohere } = await import("cohere-ai");
      return { cohere };
    } catch (e) {
      throw new Error(
        "Please install cohere-ai as a dependency with, e.g. `yarn add cohere-ai`"
      );
    }
  }
}
