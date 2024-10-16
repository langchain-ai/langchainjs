import { type ClientOptions, Groq as GroqClient } from "groq-sdk";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

/**
 * Interface for GroqEmbedding parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the Groq class.
 */
export interface GroqEmbeddingsParams extends EmbeddingsParams {
  /**
   * Model name to use
   * Alias for `model`
   */
  modelName: string;
  /** Model name to use */
  model: string;

  /**
   * TODO: This might not be needed as Groq does not seem to support this
   *
   * The number of dimensions the resulting output embeddings should have.
   * Only supported in `text-embedding-3` and later models.
   *
   */
  dimensions?: number;

  /**
   * Timeout to use when making requests to Groq.
   */
  timeout?: number;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the Groq API to a maximum of 2048.
   */
  batchSize?: number;

  /**
   *
   * TODO: This might not be needed; this is an artifact of the copy-pasta
   *
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI for older models, but may not be suitable for all use cases.
   * See: https://github.com/openai/openai-python/issues/418#issuecomment-1525939500
   */
  stripNewLines?: boolean;
}

/**
 * Class for generating embeddings using the Groq API. Extends the
 * Embeddings class and implements GroqEmbeddingParams
 * @example
 * ```typescript
 * // Embed a query using GroqEmbeddings to generate embeddings for a given text
 * const model = new GroqEmbeddings();
 * const res = await model.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?",
 * );
 * console.log({ res });
 *
 * ```
 */
export class GroqEmbeddings extends Embeddings implements GroqEmbeddingsParams {
  modelName = "text-embedding-ada-002"; // TODO: verify if this works

  model = "text-embedding-ada-002"; // TODO: verify if this works

  batchSize = 512;

  // TODO: this might not be needed and is an artifact of the copy-pasta from openai embeddings
  // TODO: Update to `false` on next minor release (see: https://github.com/langchain-ai/langchainjs/pull/3612)
  stripNewLines = true;

  /**
   * TODO: this might not be needed and is an artifact of the copy-pasta from openai embeddings
   * The number of dimensions the resulting output embeddings should have.
   * Only supported in `text-embedding-3` and later models.
   */
  dimensions?: number;

  timeout?: number;

  protected client: GroqClient;

  protected clientConfig: ClientOptions;

  constructor(
    fields?: Partial<GroqEmbeddingsParams> & {
      verbose?: boolean;
      /**
       * The Groq API key to use.
       * Alias for `apiKey`.
       */
      groqApiKey?: string;
      /** The Groq API key to use. */
      apiKey?: string;
      configuration?: ClientOptions;
    },
    configuration?: ClientOptions,
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

    super(fieldsWithDefaults);

    let apiKey =
      fieldsWithDefaults?.apiKey ??
      fieldsWithDefaults?.groqApiKey ??
      getEnvironmentVariable("GROQ_API_KEY");

    if (!apiKey) {
      throw new Error("GROQ_API_KEY Not found");
    }

    this.modelName =
      fieldsWithDefaults?.model ?? fieldsWithDefaults?.modelName ?? this.model;
    this.model = this.modelName;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;

    // TODO: this might not be needed and is an artifact of openai copy-paste
    this.stripNewLines =
      fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;

    this.timeout = fieldsWithDefaults?.timeout;

    // TODO: this might not be needed and is an artifact of openai copy-paste
    this.dimensions = fieldsWithDefaults?.dimensions;

    this.clientConfig = {
      apiKey,
      baseURL: configuration?.baseURL,
      dangerouslyAllowBrowser: true,
      defaultHeaders: configuration?.defaultHeaders,
      defaultQuery: configuration?.defaultQuery,
      ...configuration,
      ...fields?.configuration,
    };
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the Groq API to generate
   * embeddings.
   * @param texts Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize,
    );

    const batchRequests = batches.map((batch) => {
      const params: GroqClient.EmbeddingCreateParams = {
        model: this.model,
        input: batch,
      };

      return this.embeddingWithRetry(params);
    });
    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];
    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { data: batchResponse } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        // TODO: figure this typeCheck thing
        //  the groq thing returns either a string or array of numbers. why?
        const typeCheck_idk_why = batchResponse[j].embedding;
        if (typeof typeCheck_idk_why === "string") {
          console.debug(
            "Skipping string embedding, expected array of numbers: Got: ",
            typeCheck_idk_why,
          );
          continue;
        }
        embeddings.push(typeCheck_idk_why);
      }
    }
    return embeddings;
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embeddingWithRetry method with the document as the input.
   * @param text Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const params: GroqClient.EmbeddingCreateParams = {
      model: this.model,
      input: this.stripNewLines ? text.replace(/\n/g, " ") : text,
    };

    const { data } = await this.embeddingWithRetry(params);
    // TODO: figure this typeCheck thing
    //  the groq thing returns either a string or array of numbers. why?
    const typeCheck_idk_why = data[0].embedding;
    if (typeof typeCheck_idk_why === "string") {
      console.debug(
        "Skipping string embedding, expected array of numbers: Got: ",
        typeCheck_idk_why,
      );
      return [];
    }
    return typeCheck_idk_why;
  }

  /**
   * Private method to make a request to the Groq API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param request Request to send to the Groq API.
   * @returns Promise that resolves to the response from the API.
   */
  protected async embeddingWithRetry(
    request: GroqClient.EmbeddingCreateParams,
  ) {
    if (!this.client) {
      const params = {
        ...this.clientConfig,
        timeout: this.timeout,
        maxRetries: 0,
      };

      // TODO: this is an artifact from the openai embeddings copy-pasta
      //   figure this out - is it really necessary?
      if (!params.baseURL) {
        delete params.baseURL;
      }

      this.client = new GroqClient(params);
    }
    const requestOptions: GroqClient.RequestOptions = {};

    return this.caller.call(async () => {
      try {
        const res = await this.client.embeddings.create(
          request,
          requestOptions,
        );
        return res;
      } catch (e) {
        const error = e;
        throw error;
      }
    });
  }
}
