import { chunkArray } from "../util/chunk.js";
import { Embeddings, EmbeddingsParams } from "./base.js";

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
    super(fields ?? {});

    const apiKey =
      fields?.apiKey ||
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.COHERE_API_KEY
        : undefined);

    if (!apiKey) {
      throw new Error("Cohere API key not found");
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.apiKey = apiKey;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    await this.maybeInitClient();

    const subPrompts = chunkArray(texts, this.batchSize);

    const embeddings: number[][] = [];

    for (let i = 0; i < subPrompts.length; i += 1) {
      const input = subPrompts[i];
      const { body } = await this.embeddingWithRetry({
        model: this.modelName,
        texts: input,
      });
      for (let j = 0; j < input.length; j += 1) {
        embeddings.push(body.embeddings[j]);
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
