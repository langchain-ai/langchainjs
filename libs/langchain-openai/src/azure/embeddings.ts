import {
  type ClientOptions,
  AzureOpenAI as AzureOpenAIClient,
  OpenAI as OpenAIClient,
} from "openai";
import { OpenAIEmbeddings, OpenAIEmbeddingsParams } from "../embeddings.js";
import {
  AzureOpenAIInput,
  OpenAICoreRequestOptions,
  LegacyOpenAIInput,
} from "../types.js";
import { getEndpoint, OpenAIEndpointConfig } from "../utils/azure.js";
import { wrapOpenAIClientError } from "../utils/openai.js";

export class AzureOpenAIEmbeddings extends OpenAIEmbeddings {
  constructor(
    fields?: Partial<OpenAIEmbeddingsParams> &
      Partial<AzureOpenAIInput> & {
        verbose?: boolean;
        /** The OpenAI API key to use. */
        apiKey?: string;
        configuration?: ClientOptions;
        deploymentName?: string;
        openAIApiVersion?: string;
      },
    configuration?: ClientOptions & LegacyOpenAIInput
  ) {
    const newFields = { ...fields };
    if (Object.entries(newFields).length) {
      // don't rewrite the fields if they are already set
      newFields.azureOpenAIApiDeploymentName =
        newFields.azureOpenAIApiDeploymentName ?? newFields.deploymentName;
      newFields.azureOpenAIApiKey =
        newFields.azureOpenAIApiKey ?? newFields.apiKey;
      newFields.azureOpenAIApiVersion =
        newFields.azureOpenAIApiVersion ?? newFields.openAIApiVersion;
    }

    super(newFields, configuration);
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
