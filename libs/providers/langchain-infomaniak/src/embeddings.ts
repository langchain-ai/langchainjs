import { OpenAIClient, type ClientOptions } from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

/**
 * Interface for InfomaniakEmbeddings parameters.
 */
export interface InfomaniakEmbeddingsParams extends EmbeddingsParams {
  /**
   * Model name to use.
   * @default "bge_multilingual_gemma2"
   */
  model?: string;

  /**
   * The number of dimensions the resulting output embeddings should have.
   * May not be supported by all models.
   */
  dimensions?: number;

  /**
   * Timeout to use when making requests.
   */
  timeout?: number;

  /**
   * The maximum number of documents to embed in a single request.
   */
  batchSize?: number;

  /**
   * Whether to strip new lines from the input text.
   */
  stripNewLines?: boolean;

  /**
   * The format to return the embeddings in. Can be either 'float' or 'base64'.
   */
  encodingFormat?: "float" | "base64";

  /**
   * The Infomaniak API key (Bearer token).
   * @default process.env.INFOMANIAK_API_KEY
   */
  apiKey?: string;

  /**
   * The Infomaniak AI product ID.
   * @default process.env.INFOMANIAK_PRODUCT_ID
   */
  productId?: string;

  /**
   * Additional OpenAI client configuration.
   */
  configuration?: ClientOptions;
}

/**
 * Class for generating embeddings using the Infomaniak AI API.
 *
 * The Infomaniak embeddings API is OpenAI-compatible.
 *
 * Setup:
 * ```bash
 * npm install @langchain/infomaniak
 * export INFOMANIAK_API_KEY="your-api-token"
 * export INFOMANIAK_PRODUCT_ID="your-product-id"
 * ```
 *
 * @example
 * ```typescript
 * import { InfomaniakEmbeddings } from "@langchain/infomaniak";
 *
 * const embeddings = new InfomaniakEmbeddings({
 *   model: "bge_multilingual_gemma2",
 * });
 *
 * const vector = await embeddings.embedQuery("Hello world");
 * console.log(vector.length);
 * ```
 */
export class InfomaniakEmbeddings extends Embeddings {
  model = "bge_multilingual_gemma2";

  batchSize = 512;

  stripNewLines = true;

  dimensions?: number;

  timeout?: number;

  encodingFormat?: "float" | "base64";

  protected client: InstanceType<typeof OpenAIClient>;

  protected clientConfig: ClientOptions;

  constructor(fields?: InfomaniakEmbeddingsParams) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };
    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults.apiKey ?? getEnvironmentVariable("INFOMANIAK_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Infomaniak API key not found. Please set the INFOMANIAK_API_KEY environment variable or pass the key into the "apiKey" field.`
      );
    }

    const productId =
      fieldsWithDefaults.productId ??
      getEnvironmentVariable("INFOMANIAK_PRODUCT_ID");
    if (!productId) {
      throw new Error(
        `Infomaniak product ID not found. Please set the INFOMANIAK_PRODUCT_ID environment variable or pass the ID into the "productId" field.`
      );
    }

    const baseURL = `https://api.infomaniak.com/2/ai/${productId}/openai/v1`;

    this.model = fieldsWithDefaults.model ?? this.model;
    this.batchSize = fieldsWithDefaults.batchSize ?? this.batchSize;
    this.stripNewLines = fieldsWithDefaults.stripNewLines ?? this.stripNewLines;
    this.timeout = fieldsWithDefaults.timeout;
    this.dimensions = fieldsWithDefaults.dimensions;
    this.encodingFormat = fieldsWithDefaults.encodingFormat;

    this.clientConfig = {
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true,
      ...fieldsWithDefaults.configuration,
    };

    this.client = new OpenAIClient({
      ...this.clientConfig,
      timeout: this.timeout,
      maxRetries: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  /**
   * Generate embeddings for an array of texts.
   * @param texts Array of texts to generate embeddings for.
   * @returns Promise resolving to a 2D array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    const batchRequests = batches.map((batch) => {
      const params: OpenAIClient.EmbeddingCreateParams = {
        model: this.model,
        input: batch,
      };
      if (this.dimensions) {
        params.dimensions = this.dimensions;
      }
      if (this.encodingFormat) {
        params.encoding_format = this.encodingFormat;
      }
      return this.embeddingWithRetry(params);
    });

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
   * Generate an embedding for a single text.
   * @param text Text to generate an embedding for.
   * @returns Promise resolving to an embedding array.
   */
  async embedQuery(text: string): Promise<number[]> {
    const params: OpenAIClient.EmbeddingCreateParams = {
      model: this.model,
      input: this.stripNewLines ? text.replace(/\n/g, " ") : text,
    };
    if (this.dimensions) {
      params.dimensions = this.dimensions;
    }
    if (this.encodingFormat) {
      params.encoding_format = this.encodingFormat;
    }
    const { data } = await this.embeddingWithRetry(params);
    return data[0].embedding;
  }

  /**
   * Make a request to the Infomaniak API with retry logic.
   */
  protected async embeddingWithRetry(
    request: OpenAIClient.EmbeddingCreateParams
  ) {
    return this.caller.call(async () => {
      const res = await this.client.embeddings.create(request);
      return res;
    });
  }
}
