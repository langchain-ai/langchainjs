import { CompletionCreateParams } from "./completion-create-params.js";

export interface ChatCompletionCreateParamsBase {
  messages: Array<CompletionCreateParams.Message>;

  model: string;

  frequency_penalty?: number;

  logit_bias?: Record<string, number>;

  logprobs?: boolean;

  max_tokens?: number;

  n?: number;

  presence_penalty?: number;

  response_format?: CompletionCreateParams.ResponseFormat;

  seed?: number;

  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   */
  stop?: string | null | Array<string>;

  stream?: boolean;

  temperature?: number;

  tool_choice?: CompletionCreateParams.ToolChoice;

  tools?: Array<CompletionCreateParams.Tool>;

  top_logprobs?: number;

  top_p?: number;

  user?: string;
}



export interface ChatCompletionCreateParamsNonStreaming extends ChatCompletionCreateParamsBase {
  stream?: false;
}

export interface ChatCompletionCreateParamsStreaming extends ChatCompletionCreateParamsBase {
  stream: true;
}

export type ChatCompletionCreateParams =
  | ChatCompletionCreateParamsNonStreaming
  | ChatCompletionCreateParamsStreaming;

export * from "./chat-completion-chunk.js";
export * from "./chat-completion.js";