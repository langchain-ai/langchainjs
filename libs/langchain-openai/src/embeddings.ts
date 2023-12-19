import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import {
  AzureOpenAIInput,
  OpenAICoreRequestOptions,
  LegacyOpenAIInput,
} from "./types.js";
import { chunkArray } from "./utils/chunk.js";
import { getEndpoint, OpenAIEndpointConfig } from "./utils/azure.js";
import { wrapOpenAIClientError } from "./utils/openai.js";

/**
 * Interface for OpenAIEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the OpenAIEmbeddings class.
 */
export interface OpenAIEmbeddingsParams extends EmbeddingsParams {
  /** Model name to use */
  modelName: string;

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the OpenAI API to a maximum of 2048.
   */
  batchSize?: number;

  /**
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI for older models, but may not be suitable for all use cases.
   * See: https://github.com/openai/openai-python/issues/418#issuecomment-1525939500
   */
  stripNewLines?: boolean;
}

/**
 * Class for generating embeddings using the OpenAI API. Extends the
 * Embeddings class and implements OpenAIEmbeddingsParams and
 * AzureOpenAIInput.
 * @example
 * ```typescript
 * // Embed a query using OpenAIEmbeddings to generate embeddings for a given text
 * const model = new OpenAIEmbeddings();
 * const res = await model.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?",
 * );
 * console.log({ res });
 *
 * ```
 */
export class OpenAIEmbeddings
  extends Embeddings
  implements OpenAIEmbeddingsParams, AzureOpenAIInput
{
  modelName = "text-embedding-ada-002";

  batchSize = 512;

  // TODO: Update to `false` on next minor release (see: https://github.com/langchain-ai/langchainjs/pull/3612)
  stripNewLines = true;

  timeout?: number;

  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  azureOpenAIBasePath?: string;

  organization?: string;

  private client: OpenAIClient;

  private clientConfig: ClientOptions;

  constructor(
    fields?: Partial<OpenAIEmbeddingsParams> &
      Partial<AzureOpenAIInput> & {
        verbose?: boolean;
        openAIApiKey?: string;
        configuration?: ClientOptions;
      },
    configuration?: ClientOptions & LegacyOpenAIInput
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

    super(fieldsWithDefaults);

    let apiKey =
      fieldsWithDefaults?.openAIApiKey ??
      getEnvironmentVariable("OPENAI_API_KEY");

    const azureApiKey =
      fieldsWithDefaults?.azureOpenAIApiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY");
    if (!azureApiKey && !apiKey) {
      throw new Error("OpenAI or Azure OpenAI API key not found");
    }

    const azureApiInstanceName =
      fieldsWithDefaults?.azureOpenAIApiInstanceName ??
      getEnvironmentVariable("AZURE_OPENAI_API_INSTANCE_NAME");

    const azureApiDeploymentName =
      (fieldsWithDefaults?.azureOpenAIApiEmbeddingsDeploymentName ||
        fieldsWithDefaults?.azureOpenAIApiDeploymentName) ??
      (getEnvironmentVariable("AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME") ||
        getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME"));

    const azureApiVersion =
      fieldsWithDefaults?.azureOpenAIApiVersion ??
      getEnvironmentVariable("AZURE_OPENAI_API_VERSION");

    this.azureOpenAIBasePath =
      fieldsWithDefaults?.azureOpenAIBasePath ??
      getEnvironmentVariable("AZURE_OPENAI_BASE_PATH");

    this.organization =
      fieldsWithDefaults?.configuration?.organization ??
      getEnvironmentVariable("OPENAI_ORGANIZATION");

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;
    this.batchSize =
      fieldsWithDefaults?.batchSize ?? (azureApiKey ? 1 : this.batchSize);
    this.stripNewLines =
      fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;
    this.timeout = fieldsWithDefaults?.timeout;

    this.azureOpenAIApiVersion = azureApiVersion;
    this.azureOpenAIApiKey = azureApiKey;
    this.azureOpenAIApiInstanceName = azureApiInstanceName;
    this.azureOpenAIApiDeploymentName = azureApiDeploymentName;

    if (this.azureOpenAIApiKey) {
      if (!this.azureOpenAIApiInstanceName && !this.azureOpenAIBasePath) {
        throw new Error("Azure OpenAI API instance name not found");
      }
      if (!this.azureOpenAIApiDeploymentName) {
        throw new Error("Azure OpenAI API deployment name not found");
      }
      if (!this.azureOpenAIApiVersion) {
        throw new Error("Azure OpenAI API version not found");
      }
      apiKey = apiKey ?? "";
    }

    this.clientConfig = {
      apiKey,
      organization: this.organization,
      baseURL: configuration?.basePath,
      dangerouslyAllowBrowser: true,
      defaultHeaders: configuration?.baseOptions?.headers,
      defaultQuery: configuration?.baseOptions?.params,
      ...configuration,
      ...fields?.configuration,
    };
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the OpenAI API to generate
   * embeddings.
   * @param texts Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    const batchRequests = batches.map((batch) =>
      this.embeddingWithRetry({
        model: this.modelName,
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
   * Method to generate an embedding for a single document. Calls the
   * embeddingWithRetry method with the document as the input.
   * @param text Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry({
      model: this.modelName,
      input: this.stripNewLines ? text.replace(/\n/g, " ") : text,
    });
    return data[0].embedding;
  }

  /**
   * Private method to make a request to the OpenAI API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param request Request to send to the OpenAI API.
   * @returns Promise that resolves to the response from the API.
   */
  private async embeddingWithRetry(
    request: OpenAIClient.EmbeddingCreateParams
  ) {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        azureOpenAIApiDeploymentName: this.azureOpenAIApiDeploymentName,
        azureOpenAIApiInstanceName: this.azureOpenAIApiInstanceName,
        azureOpenAIApiKey: this.azureOpenAIApiKey,
        azureOpenAIBasePath: this.azureOpenAIBasePath,
        baseURL: this.clientConfig.baseURL,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);

      const params = {
        ...this.clientConfig,
        baseURL: endpoint,
        timeout: this.timeout,
        maxRetries: 0,
      };

      if (!params.baseURL) {
        delete params.baseURL;
      }

      this.client = new OpenAIClient(params);
    }
    const requestOptions: OpenAICoreRequestOptions = {};
    if (this.azureOpenAIApiKey) {
      requestOptions.headers = {
        "api-key": this.azureOpenAIApiKey,
        ...requestOptions.headers,
      };
      requestOptions.query = {
        "api-version": this.azureOpenAIApiVersion,
        ...requestOptions.query,
      };
    }
    return this.caller.call(async () => {
      try {
        const res = await this.client.embeddings.create(
          request,
          requestOptions
        );
        return res;
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }
}
