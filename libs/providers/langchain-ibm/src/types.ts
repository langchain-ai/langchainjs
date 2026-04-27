import { RequestCallbacks } from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { ChatsToolChoice } from "@ibm-cloud/watsonx-ai/gateway";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BaseLLMParams } from "@langchain/core/language_models/llms";

/**
 * Utility type that makes all properties of T optional and never.
 * Useful for creating mutually exclusive type unions.
 */
export type Neverify<T> = {
  [K in keyof T]?: never;
};

/**
 * Token usage information from Watsonx API responses.
 */
export interface TokenUsage {
  generated_token_count: number;
  input_token_count: number;
}

/**
 * Authentication configuration for Watsonx AI services.
 * Supports multiple authentication methods: IAM, Bearer Token, and Cloud Pak for Data.
 */
export interface WatsonxAuth {
  watsonxAIApikey?: string;
  watsonxAIBearerToken?: string;
  watsonxAIUsername?: string;
  watsonxAIPassword?: string;
  watsonxAIUrl?: string;
  watsonxAIAuthType?: string;
  disableSSL?: boolean;
  serviceUrl: string;
  // new fields
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  authType?: string;
  authUrl?: string;
}

/**
 * Initialization parameters for Watsonx services.
 */
export interface WatsonxInit {
  authenticator?: string;
  serviceUrl: string;
  version: string;
}

/**
 * Common request options for Watsonx API calls.
 */
export interface WatsonxRequestBasicOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  streaming?: boolean;
  watsonxCallbacks?: RequestCallbacks;
  promptIndex?: number;
}

/**
 * Basic options for Watsonx chat models.
 */
export interface WatsonxChatBasicOptions
  extends BaseChatModelCallOptions, WatsonxRequestBasicOptions {}

/**
 * Basic options for Watsonx LLM models.
 */
export interface WatsonxLLMBasicOptions
  extends BaseLLMParams, WatsonxInit, WatsonxRequestBasicOptions {}

/**
 * Basic options for Watsonx rerank operations.
 */
export interface WatsonxRerankBasicOptions
  extends WatsonxInit, WatsonxRequestBasicOptions {}

/**
 * Basic options for Watsonx embeddings.
 */
export interface WatsonxEmbeddingsBasicOptions
  extends WatsonxInit, WatsonxRequestBasicOptions {}

/**
 * Base parameters for Watsonx chat operations including tool choice.
 */
export interface WatsonxBaseChatParams extends WatsonxChatBasicOptions {
  tool_choice?: WatsonxToolChoice;
}

/**
 * Information about a generated response.
 */
export interface GenerationInfo {
  text: string;
  stop_reason: string | undefined;
  generated_token_count: number;
  input_token_count: number;
}

/**
 * Streaming response chunk from Watsonx API.
 */
export interface ResponseChunk {
  id: number;
  event: string;
  data: {
    results: (TokenUsage & {
      stop_reason?: string;
      generated_text: string;
    })[];
  };
}

/**
 * Tool choice options for Watsonx chat operations.
 * Can be a specific tool choice, a string identifier, or "auto"/"any".
 */
export type WatsonxToolChoice = ChatsToolChoice | string | "auto" | "any";
