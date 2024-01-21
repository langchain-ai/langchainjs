import { Embeddings } from "@langchain/core/embeddings";
import {
    type OpenAIClientOptions as AzureOpenAIClientOptions,
    OpenAIClient as AzureOpenAIClient,
    AzureKeyCredential
  } from "@azure/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { AzureOpenAIInput, AzureOpenAIEmbeddingsParams } from "./types.js";

export class AzureOpenAIEmbeddings extends Embeddings implements AzureOpenAIEmbeddingsParams, AzureOpenAIInput {
    modelName = "text-embedding-ada-002";

    batchSize = 512;

    // TODO: Update to `false` on next minor release (see: https://github.com/langchain-ai/langchainjs/pull/3612)
    stripNewLines = true;

    timeout?: number;

    user?: string;
    
    azureOpenAIApiKey?: string;

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

        this.azureOpenAIApiDeploymentName = fields?.azureOpenAIApiDeploymentName ?? getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME");

        this.azureOpenAIEndpoint = fields?.azureOpenAIEndpoint ?? getEnvironmentVariable("AZURE_OPENAI_API_ENDPOINT");

        this.azureOpenAIApiKey = fields?.azureOpenAIApiKey ?? getEnvironmentVariable("AZURE_OPENAI_API_KEY");

        if (!this.azureOpenAIApiKey) {
            throw new Error("Azure OpenAI API key not found");
        }

        if (!this.azureOpenAIApiDeploymentName) {
            throw new Error("Azure OpenAI Completion Deployment name not found");
        }

        if (!this.azureOpenAIEndpoint) {
            throw new Error("Azure OpenAI Endpoint not found");
        }

        this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;

        this.batchSize = fieldsWithDefaults?.batchSize ?? (this.azureOpenAIApiKey ? 1 : this.batchSize);

        this.stripNewLines = fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;

        this.timeout = fieldsWithDefaults?.timeout;
        
        const azureKeyCredential: AzureKeyCredential = new AzureKeyCredential(
            this.azureOpenAIApiKey
        );

        this.client = new AzureOpenAIClient(
            this.azureOpenAIEndpoint ?? "",
            azureKeyCredential
        );
      }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        const batches = chunkArray(
            this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
            this.batchSize
        );

        const batchRequests = batches.map((batch) =>
            this.getEmbeddings(batch)
        );
        const embeddings = await Promise.all(batchRequests);

        return embeddings;
    }

    async embedQuery(document: string): Promise<number[]> {
        const input = [this.stripNewLines ? document.replace(/\n/g, " ") : document];
        return this.getEmbeddings(input);
    }

    private async getEmbeddings(input: string[]){
        if (!this.azureOpenAIApiDeploymentName) {
            throw new Error("Azure OpenAI Completion Deployment name not found");
        }

        const res = await this.client.getEmbeddings(
            this.azureOpenAIApiDeploymentName,
            input,
            {
                user: this.user,
                model: this.modelName,
                requestOptions: {
                    timeout: this.timeout
                }
            }
        );

        return res.data[0].embedding;
    }
}