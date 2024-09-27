import { Embeddings } from "@langchain/core/embeddings";
import {
  EmbeddingParameters,
  TextEmbeddingsParams,
} from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { authenticateAndSetInstance } from "./utilis/authentication.js";
import { WatsonxAuth, WatsonxParams } from "./types.js";

export interface WatsonxEmbeddingsParams
  extends Omit<EmbeddingParameters, "return_options">,
    Pick<TextEmbeddingsParams, "headers"> {}

export class WatsonxEmbeddings
  extends Embeddings
  implements WatsonxEmbeddingsParams, WatsonxParams
{
  modelId = "ibm/slate-125m-english-rtrvr";

  serviceUrl: string;

  version: string;

  spaceId?: string;

  projectId?: string;

  truncate_input_tokens?: number;

  maxRetries?: number;

  maxConcurrency?: number;

  private service: WatsonXAI;

  constructor(fields: WatsonxEmbeddingsParams & WatsonxAuth & WatsonxParams) {
    const superProps = { maxConcurrency: 2, ...fields };
    super(superProps);
    this.modelId = fields?.modelId ? fields.modelId : this.modelId;
    this.version = fields.version;
    this.serviceUrl = fields.serviceUrl;
    this.truncate_input_tokens = fields.truncate_input_tokens;
    this.maxConcurrency = fields.maxConcurrency;
    this.maxRetries = fields.maxRetries;
    if (fields.projectId && fields.spaceId)
      throw new Error("Maximum 1 id type can be specified per instance");
    else if (!fields.projectId && !fields.spaceId && !fields.idOrName)
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
      version,
      serviceUrl,
    });
    if (auth) this.service = auth;
    else throw new Error("You have not provided one type of authentication");
  }

  scopeId() {
    if (this.projectId) return { projectId: this.projectId };
    else return { spaceId: this.spaceId };
  }

  ivocationParams(): EmbeddingParameters {
    return {
      truncate_input_tokens: this.truncate_input_tokens,
    };
  }

  async completionWithRetry<T>(callback: () => T) {
    const caller = new AsyncCaller({
      maxConcurrency: this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    return caller.call(async () => callback());
  }

  async listModels() {
    const listModelParams = {
      filters: "function_embedding",
    };
    const listModels = await this.completionWithRetry(() =>
      this.service.listFoundationModelSpecs(listModelParams)
    );
    return listModels.result.resources?.map((item) => item.model_id);
  }

  private async embedSingleText(inputs: string[]) {
    const textEmbeddingParams: TextEmbeddingsParams = {
      inputs,
      modelId: this.modelId,
      ...this.scopeId(),
      parameters: this.ivocationParams(),
    };

    const embeddings = await this.completionWithRetry(() =>
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
