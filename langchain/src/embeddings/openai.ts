import {
  Configuration,
  OpenAIApi,
  CreateEmbeddingRequest,
  ConfigurationParameters,
} from "openai";
import { StreamingAxiosConfiguration } from "util/axios-types.js";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { chunkArray } from "../util/chunk.js";
import { Embeddings, EmbeddingsParams } from "./base.js";

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
   * OpenAI, but may not be suitable for all use cases.
   */
  stripNewLines?: boolean;
}

export interface AzureOpenAIEmbeddingsParams {
  /**
     * API version to use when making requests to Azure OpenAI.
     */
  azureOpenAIApiVersion?: string;

  /**
   * API key to use when making requests to Azure OpenAI.
   */
  azureOpenAIApiKey?: string;

  /**
   * Azure OpenAI API instance name to use when making requests to Azure OpenAI.
   * this is the name of the instance you created in the Azure portal.
   * e.g. "my-openai-instance"
   * this will be used in the endpoint URL: https://my-openai-instance.openai.azure.com/openai/deployments/{DeploymentName}/
   */
  azureOpenAIApiInstanceName?: string;

  /**
   * Azure OpenAI API deployment name to use when making requests to Azure OpenAI.
   * this is the name of the deployment you created in the Azure portal.
   * e.g. "my-openai-deployment"
   * this will be used in the endpoint URL: https://{InstanceName}.openai.azure.com/openai/deployments/my-openai-deployment/
   */
  azureOpenAIApiDeploymentName?: string;
}

export class OpenAIEmbeddings
  extends Embeddings
  implements OpenAIEmbeddingsParams, AzureOpenAIEmbeddingsParams
{
  modelName = "text-embedding-ada-002";

  batchSize = 512;

  stripNewLines = true;

  timeout?: number;

  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  private client: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<OpenAIEmbeddingsParams> & Partial<AzureOpenAIEmbeddingsParams> & {
      verbose?: boolean;
      openAIApiKey?: string;
    },
    configuration?: ConfigurationParameters
  ) {
    super(fields ?? {});

    const apiKey =
      fields?.openAIApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.OPENAI_API_KEY
        : undefined);

    const azureApiKey = 
      fields?.azureOpenAIApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_KEY
        : undefined);
    if (!azureApiKey && !apiKey) {
      throw new Error("(Azure) OpenAI API key not found");
    }

    const azureApiInstanceName =
      fields?.azureOpenAIApiInstanceName ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_INSTANCE_NAME
        : undefined);
    
    const azureApiDeploymentName =
      fields?.azureOpenAIApiDeploymentName ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_DEPLOYMENT_NAME
        : undefined);
    
    const azureApiVersion =
      fields?.azureOpenAIApiVersion ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_VERSION
        : undefined);

    this.modelName = fields?.modelName ?? this.modelName;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.timeout = fields?.timeout;

    this.azureOpenAIApiVersion = azureApiVersion;
    this.azureOpenAIApiKey = azureApiKey;
    this.azureOpenAIApiInstanceName = azureApiInstanceName;
    this.azureOpenAIApiDeploymentName = azureApiDeploymentName;

    if (this.azureOpenAIApiKey) {
      if (!this.azureOpenAIApiInstanceName) {
        throw new Error("Azure OpenAI API instance name not found");
      }
      if (!this.azureOpenAIApiDeploymentName) {
        throw new Error("Azure OpenAI API deployment name not found");
      }
      if (!this.azureOpenAIApiVersion) {
        throw new Error("Azure OpenAI API version not found");
      }
    }

    this.clientConfig = {
      apiKey,
      ...configuration,
    };
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const subPrompts = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replaceAll("\n", " ")) : texts,
      this.batchSize
    );

    const embeddings: number[][] = [];

    for (let i = 0; i < subPrompts.length; i += 1) {
      const input = subPrompts[i];
      const { data } = await this.embeddingWithRetry({
        model: this.modelName,
        input,
      });
      for (let j = 0; j < input.length; j += 1) {
        embeddings.push(data.data[j].embedding);
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry({
      model: this.modelName,
      input: this.stripNewLines ? text.replaceAll("\n", " ") : text,
    });
    return data.data[0].embedding;
  }

  private async embeddingWithRetry(request: CreateEmbeddingRequest) {
    if (!this.client) {
      const endpoint = this.azureOpenAIApiKey ? `https://${this.azureOpenAIApiInstanceName}.openai.azure.com/openai/deployments/${this.azureOpenAIApiDeploymentName}/` : this.clientConfig.basePath;
      const clientConfig = new Configuration({
        ...this.clientConfig,
        basePath: endpoint,
        baseOptions: {
          timeout: this.timeout,
          adapter: fetchAdapter,
          ...this.clientConfig.baseOptions,
        },
      });
      this.client = new OpenAIApi(clientConfig);
    }
    const axiosOptions = {} as StreamingAxiosConfiguration;
    if (this.azureOpenAIApiKey) {
      axiosOptions.headers = {
        "api-key": this.azureOpenAIApiKey,
        ...axiosOptions.headers,
      },
      axiosOptions.params = {
        "api-version": this.azureOpenAIApiVersion,
        ...axiosOptions.params,
      }
    }
    return this.caller.call(
      this.client.createEmbedding.bind(this.client),
      request,
      axiosOptions
    );
  }
}
