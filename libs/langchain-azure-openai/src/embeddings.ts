import { Embeddings } from "@langchain/core/embeddings";
import {
  type OpenAIClientOptions as AzureOpenAIClientOptions,
  OpenAIClient as AzureOpenAIClient,
  AzureKeyCredential,
  OpenAIKeyCredential,
} from "@azure/openai";
import {
  KeyCredential,
  TokenCredential,
  isTokenCredential,
} from "@azure/core-auth";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { AzureOpenAIInput, AzureOpenAIEmbeddingsParams } from "./types.js";
import { USER_AGENT_PREFIX } from "./constants.js";

/** @deprecated Import from "@langchain/openai" instead. */
export class AzureOpenAIEmbeddings
  extends Embeddings
  implements AzureOpenAIEmbeddingsParams, AzureOpenAIInput
{
  modelName = "text-embedding-ada-002";

  model = "text-embedding-ada-002";

  batchSize = 512;

  stripNewLines = false;

  timeout?: number;

  user?: string;

  azureOpenAIApiKey?: string;

  apiKey?: string;

  azureOpenAIEndpoint?: string;

  azureOpenAIApiDeploymentName?: string;

  private client: AzureOpenAIClient;

  constructor(
    fields?: Partial<AzureOpenAIEmbeddingsParams> &
      Partial<AzureOpenAIInput> & {
        configuration?: AzureOpenAIClientOptions;
      }
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

    super(fieldsWithDefaults);

    this.azureOpenAIApiDeploymentName =
      (fieldsWithDefaults?.azureOpenAIEmbeddingsApiDeploymentName ||
        fieldsWithDefaults?.azureOpenAIApiDeploymentName) ??
      (getEnvironmentVariable("AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME") ||
        getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME"));

    this.azureOpenAIEndpoint =
      fields?.azureOpenAIEndpoint ??
      getEnvironmentVariable("AZURE_OPENAI_API_ENDPOINT");

    const openAiApiKey =
      fields?.apiKey ??
      fields?.openAIApiKey ??
      getEnvironmentVariable("OPENAI_API_KEY");

    this.azureOpenAIApiKey =
      fields?.apiKey ??
      fields?.azureOpenAIApiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY") ??
      openAiApiKey;
    this.apiKey = this.azureOpenAIApiKey;

    const azureCredential =
      fields?.credentials ??
      (this.apiKey === openAiApiKey
        ? new OpenAIKeyCredential(this.apiKey ?? "")
        : new AzureKeyCredential(this.apiKey ?? ""));

    // eslint-disable-next-line no-instanceof/no-instanceof
    const isOpenAIApiKey = azureCredential instanceof OpenAIKeyCredential;

    if (!this.apiKey && !fields?.credentials) {
      throw new Error("Azure OpenAI API key not found");
    }

    if (!this.azureOpenAIEndpoint && !isOpenAIApiKey) {
      throw new Error("Azure OpenAI Endpoint not found");
    }

    if (!this.azureOpenAIApiDeploymentName && !isOpenAIApiKey) {
      throw new Error("Azure OpenAI Deployment name not found");
    }

    this.modelName =
      fieldsWithDefaults?.model ?? fieldsWithDefaults?.modelName ?? this.model;
    this.model = this.modelName;

    this.batchSize =
      fieldsWithDefaults?.batchSize ?? (this.apiKey ? 1 : this.batchSize);

    this.stripNewLines =
      fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;

    this.timeout = fieldsWithDefaults?.timeout;

    const options = {
      userAgentOptions: { userAgentPrefix: USER_AGENT_PREFIX },
    };

    if (isOpenAIApiKey) {
      this.client = new AzureOpenAIClient(
        azureCredential as OpenAIKeyCredential
      );
    } else if (isTokenCredential(azureCredential)) {
      this.client = new AzureOpenAIClient(
        this.azureOpenAIEndpoint ?? "",
        azureCredential as TokenCredential,
        options
      );
    } else {
      this.client = new AzureOpenAIClient(
        this.azureOpenAIEndpoint ?? "",
        azureCredential as KeyCredential,
        options
      );
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    const batchRequests = batches.map((batch) => this.getEmbeddings(batch));
    const embeddings = await Promise.all(batchRequests);
    return embeddings.flat();
  }

  async embedQuery(document: string): Promise<number[]> {
    const input = [
      this.stripNewLines ? document.replace(/\n/g, " ") : document,
    ];
    const embeddings = await this.getEmbeddings(input);
    return embeddings.flat();
  }

  private async getEmbeddings(input: string[]): Promise<number[][]> {
    const deploymentName = this.azureOpenAIApiDeploymentName || this.model;

    const res = await this.caller.call(() =>
      this.client.getEmbeddings(deploymentName, input, {
        user: this.user,
        model: this.model,
        requestOptions: {
          timeout: this.timeout,
        },
      })
    );

    return res.data.map((data) => data.embedding);
  }
}
