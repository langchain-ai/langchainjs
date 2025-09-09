import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { CohereClient, type Cohere } from "cohere-ai";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the CohereEmbeddings class.
 * @deprecated Use `CohereEmbeddingsParams` from `@langchain/cohere` instead.
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
 * const model = new ChatOpenAI({ model: "gpt-4o-mini" });
 * const res = await model.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?",
 * );
 * console.log({ res });
 * ```
 * @deprecated Use `CohereEmbeddings` from `@langchain/cohere` instead.
 */
export class CohereEmbeddings
  extends Embeddings
  implements CohereEmbeddingsParams
{
  modelName = "small";

  batchSize = 48;

  private apiKey: string;

  private client: CohereClient;

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
    this.client = new CohereClient({ token: this.apiKey });
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
        model: this.modelName,
        texts: batch,
      })
    );

    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      if (batchResponses[i].responseType === "embeddings_floats") {
        const batchResponse = batchResponses[
          i
        ] as Cohere.EmbedResponse.EmbeddingsFloats;
        embeddings.push(...batchResponse.embeddings);
      } else {
        throw new Error("Unexpected response type");
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
    const result = await this.embeddingWithRetry({
      model: this.modelName,
      texts: [text],
    });
    return (result as Cohere.EmbedResponse.EmbeddingsFloats).embeddings[0];
  }

  /**
   * Generates embeddings with retry capabilities.
   * @param request - An object containing the request parameters for generating embeddings.
   * @returns A Promise that resolves to the API response.
   */
  private async embeddingWithRetry(request: Cohere.EmbedRequest) {
    return this.caller.call(
      this.client.embed.bind(this.client),
      request
    ) as Promise<Cohere.EmbedResponse>;
  }
}
