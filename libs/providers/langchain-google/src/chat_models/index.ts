import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { WebApiClient } from "../clients/index.js";
import {
  BaseChatGoogle,
  BaseChatGoogleCallOptions,
  BaseChatGoogleParams,
  getGoogleChatModelParams,
} from "./base.js";

/**
 * Configuration parameters for the ChatGoogleGenerativeAI model.
 *
 * This interface extends the base Google chat model parameters and adds
 * specific configuration options for the Generative AI API.
 */
export interface ChatGoogleGenerativeAIParams extends BaseChatGoogleParams {
  /**
   * Google API key for authentication with the Generative AI API.
   *
   * If not provided, the model will attempt to use the `GOOGLE_API_KEY`
   * environment variable. You can obtain an API key from the
   * [Google AI Studio](https://makersuite.google.com/app/apikey).
   */
  apiKey?: string;

  /** @deprecated Import from `@langchain/google/node` to configure google auth options */
  authOptions?: never;
}

/**
 * Call options for the ChatGoogleGenerativeAI model.
 *
 * This interface extends the base Google chat model call options and provides
 * configuration for individual model invocations. These options can be passed
 * when calling methods like `invoke()`, `stream()`, or `batch()` to customize
 * the behavior of a specific request.
 */
export interface ChatGoogleGenerativeAICallOptions
  extends BaseChatGoogleCallOptions {}

export class ChatGoogleGenerativeAI extends BaseChatGoogle<ChatGoogleGenerativeAICallOptions> {
  apiKey?: string;

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
    params.apiKey = params?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    const apiClient = params?.apiClient ?? new WebApiClient(params);
    super({ ...params, apiClient });

    this.apiKey = params.apiKey;
  }
}

/**
 * Parameters for configuring the ChatGoogleVertexAI model.
 *
 * This interface extends the base Google chat model parameters and provides
 * configuration options specific to Google Vertex AI. These parameters are
 * used when instantiating a new ChatGoogleVertexAI instance.
 */
export interface ChatGoogleVertexAIParams extends BaseChatGoogleParams {
  /**
   * Google API key for authentication with the Vertex AI API.
   *
   * If not provided, the model will attempt to use the `GOOGLE_API_KEY`
   * environment variable. You can obtain an API key from the
   * [Google Cloud Console](https://console.cloud.google.com/).
   */
  apiKey?: string;

  /** @deprecated Import from `@langchain/google/node` to configure google auth options */
  authOptions?: never;
}

/**
 * Call options for the ChatGoogleVertexAI model.
 *
 * This interface extends the base Google chat model call options and provides
 * configuration options that can be passed when invoking the ChatGoogleVertexAI model.
 * These options allow you to customize the behavior of individual model calls.
 */
export interface ChatGoogleVertexAICallOptions
  extends BaseChatGoogleCallOptions {}

export class ChatGoogleVertexAI extends BaseChatGoogle<ChatGoogleVertexAICallOptions> {
  apiKey?: string;

  _llmType() {
    return "vertexai";
  }

  getBaseUrl() {
    return new URL(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/`
    );
  }

  constructor(model: string, params?: Omit<ChatGoogleVertexAIParams, "model">);
  constructor(params: ChatGoogleVertexAIParams);
  constructor(
    modelOrParams: string | ChatGoogleVertexAIParams,
    paramsArg?: Omit<ChatGoogleVertexAIParams, "model">
  ) {
    const params = getGoogleChatModelParams(modelOrParams, paramsArg);
    params.apiKey = params?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    const apiClient = params?.apiClient ?? new WebApiClient(params);
    super({ ...params, apiClient });

    this.apiKey = params.apiKey;
  }
}
