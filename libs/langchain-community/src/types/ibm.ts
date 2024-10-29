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

export interface WatsonxParams extends WatsonxInit {
  model?: string;
  spaceId?: string;
  projectId?: string;
  idOrName?: string;
  maxConcurrency?: number;
  maxRetries?: number;
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
