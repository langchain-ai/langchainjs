import { RequestCallbacks } from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { ChatsToolChoice } from "@ibm-cloud/watsonx-ai/gateway";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BaseLLMParams } from "@langchain/core/language_models/llms";

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
  watsonxAIApikey?: string;
  watsonxAIBearerToken?: string;
  watsonxAIUsername?: string;
  watsonxAIPassword?: string;
  watsonxAIUrl?: string;
  watsonxAIAuthType?: string;
  disableSSL?: boolean;
  serviceUrl: string;
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
  extends BaseChatModelCallOptions,
    WatsonxRequestBasicOptions {}

export interface WatsonxLLMBasicOptions
  extends BaseLLMParams,
    WatsonxInit,
    WatsonxRequestBasicOptions {}

export interface WatsonxRerankBasicOptions
  extends WatsonxInit,
    WatsonxRequestBasicOptions {}

export interface WatsonxEmbeddingsBasicOptions
  extends WatsonxInit,
    WatsonxRequestBasicOptions {}

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

// export type Keys = keyof WatsonxGatewayCallParams;
// type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
// type DebugKeys = Expand<Record<Keys, unknown>>;
