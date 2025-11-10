import { WebApiClient } from "../clients/index.js";
import {
  BaseChatGoogle,
  BaseChatGoogleCallOptions,
  BaseChatGoogleParams,
  getGoogleChatModelParams,
} from "./base.js";

export interface ChatGoogleGenerativeAIParams extends BaseChatGoogleParams {
  apiKey?: string;
  /** @deprecated Import from `@langchain/google/node` to configure google auth options */
  authOptions?: never;
}

export interface ChatGoogleGenerativeAICallOptions
  extends BaseChatGoogleCallOptions {}

export class ChatGoogleGenerativeAI extends BaseChatGoogle<ChatGoogleGenerativeAICallOptions> {
  _llmType() {
    return "generativeai";
  }

  getBaseUrl() {
    return new URL(`https://generativelanguage.googleapis.com/v1beta/models/`);
  }

  constructor(
    model: string,
    params?: Omit<ChatGoogleGenerativeAIParams, "model">
  );
  constructor(params: ChatGoogleGenerativeAIParams);
  constructor(
    modelOrParams: string | ChatGoogleGenerativeAIParams,
    paramsArg?: Omit<ChatGoogleGenerativeAIParams, "model">
  ) {
    const params = getGoogleChatModelParams(modelOrParams, paramsArg);
    const apiClient = params?.apiClient ?? new WebApiClient(params);
    super({ ...params, apiClient });
  }
}

export interface ChatGoogleVertexAIParams extends BaseChatGoogleParams {
  apiKey?: string;
  /** @deprecated Import from `@langchain/google/node` to configure google auth options */
  authOptions?: never;
}

export interface ChatGoogleVertexAICallOptions
  extends BaseChatGoogleCallOptions {}

export class ChatGoogleVertexAI extends BaseChatGoogle<ChatGoogleVertexAICallOptions> {
  constructor(model: string, params?: Omit<ChatGoogleVertexAIParams, "model">);
  constructor(params: ChatGoogleVertexAIParams);
  constructor(
    modelOrParams: string | ChatGoogleVertexAIParams,
    paramsArg?: Omit<ChatGoogleVertexAIParams, "model">
  ) {
    const params = getGoogleChatModelParams(modelOrParams, paramsArg);
    const apiClient = params?.apiClient ?? new WebApiClient(params);
    super({ ...params, apiClient });
  }

  _llmType() {
    return "vertexai";
  }

  getBaseUrl() {
    return new URL(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/`
    );
  }
}
