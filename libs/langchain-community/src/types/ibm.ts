import { RequestCallbacks } from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";

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
}

export interface WatsonxInit {
  authenticator?: string;
  serviceUrl: string;
  version: string;
}

export interface WatsonxChatBasicOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  streaming?: boolean;
  watsonxCallbacks?: RequestCallbacks;
}

export interface WatsonxParams extends WatsonxInit, WatsonxChatBasicOptions {
  model: string;
  spaceId?: string;
  projectId?: string;
}

export type Neverify<T> = {
  [K in keyof T]?: never;
};

export interface WatsonxDeployedParams
  extends WatsonxInit,
    WatsonxChatBasicOptions {
  idOrName?: string;
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
