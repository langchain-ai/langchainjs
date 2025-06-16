import { type ClientOptions, AzureOpenAI as AzureOpenAIClient } from "openai";
import { type BaseLLMParams } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { OpenAI } from "../llms.js";
import { OpenAIEndpointConfig, getEndpoint } from "../utils/azure.js";
import type {
  OpenAIInput,
  AzureOpenAIInput,
  OpenAICoreRequestOptions,
} from "../types.js";
import { normalizeHeaders } from "../utils/headers.js";

export class AzureOpenAI extends OpenAI {
  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureADTokenProvider?: () => Promise<string>;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  azureOpenAIBasePath?: string;

  azureOpenAIEndpoint?: string;

  get lc_aliases(): Record<string, string> {
    return {
      ...super.lc_aliases,
      openAIApiKey: "openai_api_key",
      openAIApiVersion: "openai_api_version",
      openAIBasePath: "openai_api_base",
      deploymentName: "deployment_name",
      azureOpenAIEndpoint: "azure_endpoint",
      azureOpenAIApiVersion: "openai_api_version",
      azureOpenAIBasePath: "openai_api_base",
      azureOpenAIApiDeploymentName: "deployment_name",
    };
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      ...super.lc_secrets,
      azureOpenAIApiKey: "AZURE_OPENAI_API_KEY",
    };
  }

  constructor(
    fields?: Partial<OpenAIInput> & {
      openAIApiKey?: string;
      openAIApiVersion?: string;
      openAIBasePath?: string;
      deploymentName?: string;
    } & Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: ClientOptions;
      }
  ) {
    super(fields);

    this.azureOpenAIApiDeploymentName =
      (fields?.azureOpenAIApiCompletionsDeploymentName ||
        fields?.azureOpenAIApiDeploymentName) ??
      (getEnvironmentVariable("AZURE_OPENAI_API_COMPLETIONS_DEPLOYMENT_NAME") ||
        getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME"));

    this.azureOpenAIApiKey =
      fields?.azureOpenAIApiKey ??
      fields?.openAIApiKey ??
      fields?.apiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY");

    this.azureOpenAIApiInstanceName =
      fields?.azureOpenAIApiInstanceName ??
      getEnvironmentVariable("AZURE_OPENAI_API_INSTANCE_NAME");

    this.azureOpenAIApiVersion =
      fields?.azureOpenAIApiVersion ??
      fields?.openAIApiVersion ??
      getEnvironmentVariable("AZURE_OPENAI_API_VERSION");

    this.azureOpenAIBasePath =
      fields?.azureOpenAIBasePath ??
      getEnvironmentVariable("AZURE_OPENAI_BASE_PATH");

    this.azureOpenAIEndpoint =
      fields?.azureOpenAIEndpoint ??
      getEnvironmentVariable("AZURE_OPENAI_ENDPOINT");

    this.azureADTokenProvider = fields?.azureADTokenProvider;

    if (!this.azureOpenAIApiKey && !this.apiKey && !this.azureADTokenProvider) {
      throw new Error("Azure OpenAI API key or Token Provider not found");
    }
  }

  protected _getClientOptions(
    options: OpenAICoreRequestOptions | undefined
  ): OpenAICoreRequestOptions {
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

      const defaultHeaders = normalizeHeaders(params.defaultHeaders);
      params.defaultHeaders = {
        ...params.defaultHeaders,
        "User-Agent": defaultHeaders["User-Agent"]
          ? `${defaultHeaders["User-Agent"]}: langchainjs-azure-openai-v2`
          : `langchainjs-azure-openai-v2`,
      };

      this.client = new AzureOpenAIClient({
        apiVersion: this.azureOpenAIApiVersion,
        azureADTokenProvider: this.azureADTokenProvider,
        ...params,
      });
    }

    const requestOptions = {
      ...this.clientConfig,
      ...options,
    } as OpenAICoreRequestOptions;
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
    return requestOptions;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    const json = super.toJSON() as unknown;

    function isRecord(obj: unknown): obj is Record<string, unknown> {
      return typeof obj === "object" && obj != null;
    }

    if (isRecord(json) && isRecord(json.kwargs)) {
      delete json.kwargs.azure_openai_base_path;
      delete json.kwargs.azure_openai_api_deployment_name;
      delete json.kwargs.azure_openai_api_key;
      delete json.kwargs.azure_openai_api_version;
      delete json.kwargs.azure_open_ai_base_path;
    }

    return json;
  }
}
