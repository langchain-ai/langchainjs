import { RequestCallbacks } from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { ChatsToolChoice } from "@ibm-cloud/watsonx-ai/gateway";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BaseLLMParams } from "@langchain/core/language_models/llms";
// Export custom error classes
export {
  WatsonxError,
  WatsonxAuthenticationError,
  WatsonxValidationError,
  WatsonxConfigurationError,
  WatsonxUnsupportedOperationError,
} from "./types/errors.js";


export type Neverify<T> = {
  [K in keyof T]?: never;
};

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type XOR<T, U> = T | U extends object
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;

export interface TokenUsage {
  generated_token_count: number;
  input_token_count: number;
}

export interface WatsonxAuth {
  /**
   * @deprecated Use `apiKey` instead. Will be removed in v1.0.0.
   */
  watsonxAIApikey?: string;
  /**
   * @deprecated Use `bearerToken` instead. Will be removed in v1.0.0.
   */
  watsonxAIBearerToken?: string;
  /**
   * @deprecated Use `username` instead. Will be removed in v1.0.0.
   */
  watsonxAIUsername?: string;
  /**
   * @deprecated Use `password` instead. Will be removed in v1.0.0.
   */
  watsonxAIPassword?: string;
  /**
   * @deprecated Use `authUrl` instead. Will be removed in v1.0.0.
   */
  watsonxAIUrl?: string;
  /**
   * @deprecated Use `authType` instead. Will be removed in v1.0.0.
   */
  watsonxAIAuthType?: string;
  /** Disable SSL verification (only for development/testing) */
  disableSSL?: boolean;
  /** IBM watsonx.ai service URL */
  serviceUrl: string;
  /** IBM Cloud API key for IAM authentication */
  apiKey?: string;
  /** Bearer token for authentication */
  bearerToken?: string;
  /** Username for CP4D authentication */
  username?: string;
  /** Password for CP4D authentication */
  password?: string;
  /** Authentication type: "iam", "bearertoken", "cp4d", or "aws" */
  authType?: string;
  /** Authentication URL for CP4D */
  authUrl?: string;
}

export interface WatsonxInit {
  authenticator?: string;
  serviceUrl: string;
  version: string;
}

export interface WatsonxRequestBasicOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  streaming?: boolean;
  watsonxCallbacks?: RequestCallbacks;
  promptIndex?: number;
}
export interface WatsonxChatBasicOptions
  extends BaseChatModelCallOptions, WatsonxRequestBasicOptions {}

export interface WatsonxLLMBasicOptions
  extends BaseLLMParams, WatsonxInit, WatsonxRequestBasicOptions {}

export interface WatsonxRerankBasicOptions
  extends WatsonxInit, WatsonxRequestBasicOptions {}

export interface WatsonxEmbeddingsBasicOptions
  extends WatsonxInit, WatsonxRequestBasicOptions {}

export interface WatsonxBaseChatParams extends WatsonxChatBasicOptions {
  tool_choice?: WatsonxTooChoice;
}

export interface GenerationInfo {
  text: string;
  stop_reason: string | undefined;
  generated_token_count: number;
  input_token_count: number;
}

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

export type WatsonxTooChoice = ChatsToolChoice | string | "auto" | "any";
