import { Embeddings } from "@langchain/core/embeddings";
import {
  EmbeddingParameters,
  TextEmbeddingsParams,
} from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { WatsonxAuth, WatsonxParams } from "../types/ibm.js";
import { authenticateAndSetInstance } from "../utils/ibm.js";

export interface WatsonxEmbeddingsParams
  extends Pick<TextEmbeddingsParams, "headers"> {
  truncateInputTokens?: number;
}

export interface WatsonxInputEmbeddings
  extends Omit<WatsonxParams, "idOrName"> {
  truncateInputTokens?: number;
}

export class WatsonxEmbeddings
  extends Embeddings
  implements WatsonxEmbeddingsParams, WatsonxParams
{
  model: string;

  serviceUrl: string;

  version: string;

  spaceId?: string;

  projectId?: string;

  truncateInputTokens?: number;

  maxRetries?: number;

  maxConcurrency?: number;

  private service: WatsonXAI;

  constructor(fields: WatsonxInputEmbeddings & WatsonxAuth) {
    const superProps = { maxConcurrency: 2, ...fields };
    super(superProps);
    this.model = fields.model;
    this.version = fields.version;
    this.serviceUrl = fields.serviceUrl;
    this.truncateInputTokens = fields.truncateInputTokens;
    this.maxConcurrency = fields.maxConcurrency;
    this.maxRetries = fields.maxRetries ?? 0;
    if (fields.projectId && fields.spaceId)
      throw new Error("Maximum 1 id type can be specified per instance");
    else if (!fields.projectId && !fields.spaceId)
      throw new Error(
        "No id specified! At least id of 1 type has to be specified"
      );
    this.projectId = fields?.projectId;
    this.spaceId = fields?.spaceId;
    this.serviceUrl = fields?.serviceUrl;
    const {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    } = fields;
    const auth = authenticateAndSetInstance({
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    });
    if (auth) this.service = auth;
    else throw new Error("You have not provided one type of authentication");
  }

  scopeId() {
    if (this.projectId)
      return { projectId: this.projectId, modelId: this.model };
    else return { spaceId: this.spaceId, modelId: this.model };
  }

  invocationParams(): EmbeddingParameters {
    return {
      truncate_input_tokens: this.truncateInputTokens,
    };
  }

  async listModels() {
    const listModelParams = {
      filters: "function_embedding",
    };
    const caller = new AsyncCaller({
      maxConcurrency: this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const listModels = await caller.call(() =>
      this.service.listFoundationModelSpecs(listModelParams)
    );
    return listModels.result.resources?.map((item) => item.model_id);
  }

  private async embedSingleText(inputs: string[]) {
    const textEmbeddingParams: TextEmbeddingsParams = {
      inputs,
      ...this.scopeId(),
      parameters: this.invocationParams(),
    };
    const caller = new AsyncCaller({
      maxConcurrency: this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const embeddings = await caller.call(() =>
      this.service.embedText(textEmbeddingParams)
    );
    return embeddings.result.results.map((item) => item.embedding);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const data = await this.embedSingleText(documents);
    return data;
  }

  async embedQuery(document: string): Promise<number[]> {
    const data = await this.embedSingleText([document]);
    return data[0];
  }
}
