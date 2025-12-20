import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";

import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { CreateEmbeddingsParams, Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import {
  WatsonxAuth,
  WatsonxEmbeddingsBasicOptions,
  XOR,
} from "../types/ibm.js";
import {
  authenticateAndSetGatewayInstance,
  authenticateAndSetInstance,
  checkValidProps,
  expectOneOf,
} from "../utils/ibm.js";

export interface WatsonxEmbeddingsParams
  extends EmbeddingsParams,
    Omit<WatsonXAI.TextEmbeddingsParams, "modelId" | "inputs" | "parameters"> {
  /** Represents the maximum number of input tokens accepted. This can be used to avoid requests failing due to
   *  input being longer than configured limits. If the text is truncated, then it truncates the end of the input (on
   *  the right), so the start of the input will remain the same. If this value exceeds the `maximum sequence length`
   *  (refer to the documentation to find this value for the model) then the call will fail if the total number of
   *  tokens exceeds the `maximum sequence length`.
   */
  truncateInputTokens?: number;
  /** The return options for text embeddings. */
  returnOptions?: WatsonXAI.EmbeddingReturnOptions;
  /** The `id` of the model to be used for this request. Please refer to the [list of
   *  models](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-models-embed.html?context=wx&audience=wdp).
   */
  model: string;
}
export interface WatsonxInputEmbeddings
  extends WatsonxEmbeddingsBasicOptions,
    WatsonxEmbeddingsParams {}

export type WatsonxEmbeddingsGatewayKwargs = Omit<
  CreateEmbeddingsParams,
  "input" | keyof WatsonxEmbeddingsParams
>;

export interface WatsonxEmbeddingsGatewayParams extends EmbeddingsParams {
  modelGatewayKwargs?: WatsonxEmbeddingsGatewayKwargs;
  modelGateway: boolean;
}

export interface WatsonxInputGatewayEmbeddings
  extends WatsonxEmbeddingsBasicOptions,
    WatsonxEmbeddingsGatewayParams,
    Omit<
      CreateEmbeddingsParams,
      keyof WatsonxEmbeddingsGatewayKwargs | "input"
    > {}

export type WatsonxEmbeddingsConstructor = XOR<
  WatsonxInputEmbeddings,
  WatsonxInputGatewayEmbeddings
> &
  WatsonxAuth;

export class WatsonxEmbeddings
  extends Embeddings
  implements WatsonxEmbeddingsParams, WatsonxInputGatewayEmbeddings
{
  model: string;

  serviceUrl: string;

  version: string;

  spaceId?: string;

  projectId?: string;

  truncateInputTokens?: number;

  returnOptions?: WatsonXAI.EmbeddingReturnOptions;

  maxRetries?: number;

  maxConcurrency = 1;

  modelGatewayKwargs?: WatsonxEmbeddingsGatewayKwargs | undefined;

  modelGateway = false;

  protected service?: WatsonXAI;

  protected gateway?: Gateway;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkValidProperties(fields: any, includeCommonProps = true) {
    const alwaysAllowedProps = ["headers", "signal", "promptIndex"];

    const authProps = [
      "serviceUrl",
      "watsonxAIApikey",
      "watsonxAIBearerToken",
      "watsonxAIUsername",
      "watsonxAIPassword",
      "watsonxAIUrl",
      "watsonxAIAuthType",
      "disableSSL",
    ];

    const sharedProps = [
      "maxRetries",
      "watsonxCallbacks",
      "authenticator",
      "serviceUrl",
      "version",
      "streaming",
      "callbackManager",
      "callbacks",
      "maxConcurrency",
      "cache",
      "metadata",
      "concurrency",
      "onFailedAttempt",
      "concurrency",
      "verbose",
      "tags",
      "headers",
      "signal",
      "disableStreaming",
    ];

    const projectOrSpaceProps = [
      "truncateInputTokens",
      "returnOptions",
      "model",
      "projectId",
      "spaceId",
    ];
    const gatewayProps = ["model", "modelGatewayKwargs", "modelGateway"];
    const validProps: string[] = [...alwaysAllowedProps];
    if (includeCommonProps) validProps.push(...authProps, ...sharedProps);

    if (this.modelGateway) {
      validProps.push(...gatewayProps);
    } else if (this.spaceId || this.projectId) {
      validProps.push(...projectOrSpaceProps);
    }

    checkValidProps(fields, validProps);
  }

  constructor(fields: WatsonxEmbeddingsConstructor) {
    super(fields);
    expectOneOf(fields, ["projectId", "spaceId", "modelGateway"], true);
    this.projectId = fields?.projectId;
    this.spaceId = fields?.spaceId;
    this.modelGateway = fields.modelGateway ?? this.modelGateway;

    this.checkValidProperties(fields);

    this.model = fields.model;
    this.version = fields.version;
    this.serviceUrl = fields.serviceUrl;
    this.truncateInputTokens = fields.truncateInputTokens;
    this.returnOptions = fields.returnOptions;
    this.maxConcurrency = fields.maxConcurrency ?? this.maxConcurrency;
    this.maxRetries = fields.maxRetries ?? 0;
    this.serviceUrl = fields?.serviceUrl;
    this.modelGatewayKwargs = fields.modelGatewayKwargs;

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

    const authData = {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    };
    if (this.modelGateway) {
      const auth = authenticateAndSetGatewayInstance(authData);
      if (auth) this.gateway = auth;
      else throw new Error("You have not provided one type of authentication");
    } else {
      const auth = authenticateAndSetInstance(authData);
      if (auth) this.service = auth;
      else throw new Error("You have not provided one type of authentication");
    }
  }

  scopeId():
    | { projectId: string; modelId: string }
    | { spaceId: string; modelId: string }
    | { model: string } {
    if (this.projectId)
      return { projectId: this.projectId, modelId: this.model };
    else if (this.spaceId)
      return { spaceId: this.spaceId, modelId: this.model };
    else
      return {
        model: this.model,
      };
  }

  invocationParams() {
    return {
      truncate_input_tokens: this.truncateInputTokens,
      return_options: this.returnOptions,
    };
  }

  async listModels() {
    if (this.service) {
      const { service } = this;
      const listModelParams = {
        filters: "function_embedding",
      };
      const caller = new AsyncCaller({
        maxConcurrency: this.maxConcurrency,
        maxRetries: this.maxRetries,
      });
      const listModels = await caller.call(() =>
        service.listFoundationModelSpecs(listModelParams)
      );
      return listModels.result.resources?.map((item) => item.model_id);
    } else throw new Error("This method is not supported in model gateway");
  }

  private async embedSingleText(inputs: string[]) {
    const scopeId = this.scopeId();
    if ("modelId" in scopeId && this.service) {
      const { service } = this;
      const caller = new AsyncCaller({
        maxConcurrency: this.maxConcurrency,
        maxRetries: this.maxRetries,
      });
      const embeddings = await caller.call(() =>
        service.embedText({
          inputs,
          ...scopeId,
          parameters: this.invocationParams(),
        })
      );
      return embeddings.result.results.map((item) => item.embedding);
    } else if (this.gateway && "model" in scopeId) {
      const { gateway } = this;
      const caller = new AsyncCaller({
        maxConcurrency: this.maxConcurrency,
        maxRetries: this.maxRetries,
      });
      const embeddings = await caller.call(() =>
        gateway.embeddings.completion.create({
          input: inputs,
          ...scopeId,
        })
      );
      const res = embeddings.result.data.map((item) => item.embedding);
      return res;
    }
    throw new Error(
      "Invalid parameters provided. Please check passed properties to class instance"
    );
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
