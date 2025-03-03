import {
  type ClientOptions,
  AzureOpenAI as AzureOpenAIClient,
  OpenAI as OpenAIClient,
} from "openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { OpenAIEmbeddings, OpenAIEmbeddingsParams } from "../embeddings.js";
import { AzureOpenAIInput, OpenAICoreRequestOptions } from "../types.js";
import { getEndpoint, OpenAIEndpointConfig } from "../utils/azure.js";
import { wrapOpenAIClientError } from "../utils/openai.js";

export class AzureOpenAIEmbeddings extends OpenAIEmbeddings {
  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureADTokenProvider?: () => Promise<string>;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  azureOpenAIBasePath?: string;

  constructor(
    fields?: Partial<OpenAIEmbeddingsParams> &
      Partial<AzureOpenAIInput> & {
        verbose?: boolean;
        /** The OpenAI API key to use. */
        apiKey?: string;
        configuration?: ClientOptions;
        deploymentName?: string;
        openAIApiVersion?: string;
      }
  ) {
    super(fields);
    this.batchSize = fields?.batchSize ?? 1;
    this.azureOpenAIApiKey =
      fields?.azureOpenAIApiKey ??
      fields?.apiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY");

    this.azureOpenAIApiVersion =
      fields?.azureOpenAIApiVersion ??
      fields?.openAIApiVersion ??
      getEnvironmentVariable("AZURE_OPENAI_API_VERSION");

    this.azureOpenAIBasePath =
      fields?.azureOpenAIBasePath ??
      getEnvironmentVariable("AZURE_OPENAI_BASE_PATH");

    this.azureOpenAIApiInstanceName =
      fields?.azureOpenAIApiInstanceName ??
      getEnvironmentVariable("AZURE_OPENAI_API_INSTANCE_NAME");

    this.azureOpenAIApiDeploymentName =
      (fields?.azureOpenAIApiEmbeddingsDeploymentName ||
        fields?.azureOpenAIApiDeploymentName) ??
      (getEnvironmentVariable("AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME") ||
        getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME"));

    this.azureADTokenProvider = fields?.azureADTokenProvider;
  }

  protected async embeddingWithRetry(
    request: OpenAIClient.EmbeddingCreateParams
  ) {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        azureOpenAIApiDeploymentName: this.azureOpenAIApiDeploymentName,
        azureOpenAIApiInstanceName: this.azureOpenAIApiInstanceName,
        azureOpenAIApiKey: this.azureOpenAIApiKey,
        azureOpenAIBasePath: this.azureOpenAIBasePath,
        azureADTokenProvider: this.azureADTokenProvider,
        baseURL: this.clientConfig.baseURL,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);

      const params = {
        ...this.clientConfig,
        baseURL: endpoint,
        timeout: this.timeout,
        maxRetries: 0,
      };

      if (!this.azureADTokenProvider) {
        params.apiKey = openAIEndpointConfig.azureOpenAIApiKey;
      }

      if (!params.baseURL) {
        delete params.baseURL;
      }

      params.defaultHeaders = {
        ...params.defaultHeaders,
        "User-Agent": params.defaultHeaders?.["User-Agent"]
          ? `${params.defaultHeaders["User-Agent"]}: langchainjs-azure-openai-v2`
          : `langchainjs-azure-openai-v2`,
      };

      this.client = new AzureOpenAIClient({
        apiVersion: this.azureOpenAIApiVersion,
        azureADTokenProvider: this.azureADTokenProvider,
        deployment: this.azureOpenAIApiDeploymentName,
        ...params,
      });
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
