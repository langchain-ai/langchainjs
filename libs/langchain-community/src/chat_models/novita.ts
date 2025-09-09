import type {
  BaseChatModelParams,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import {
  type OpenAIClient,
  type ChatOpenAICallOptions,
  type OpenAIChatInput,
  type OpenAICoreRequestOptions,
  ChatOpenAICompletions,
} from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

type NovitaUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "logitBias"
  | "functions";

type NovitaUnsupportedCallOptions = "functions" | "function_call";

export interface ChatNovitaCallOptions
  extends Omit<ChatOpenAICallOptions, NovitaUnsupportedCallOptions> {
  response_format: {
    type: "json_object";
    schema: Record<string, unknown>;
  };
}

export interface ChatNovitaInput
  extends Omit<OpenAIChatInput, "openAIApiKey" | NovitaUnsupportedArgs>,
    BaseChatModelParams {
  /**
   * Novita API key
   * @default process.env.NOVITA_API_KEY
   */
  novitaApiKey?: string;
  /**
   * API key alias
   * @default process.env.NOVITA_API_KEY
   */
  apiKey?: string;
}

/**
 * Novita chat model implementation
 */
export class ChatNovitaAI extends ChatOpenAICompletions<ChatNovitaCallOptions> {
  static lc_name() {
    return "ChatNovita";
  }

  _llmType() {
    return "novita";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      novitaApiKey: "NOVITA_API_KEY",
      apiKey: "NOVITA_API_KEY",
    };
  }

  lc_serializable = true;

  constructor(
    fields?: Partial<
      Omit<OpenAIChatInput, "openAIApiKey" | NovitaUnsupportedArgs>
    > &
      BaseChatModelParams & {
        novitaApiKey?: string;
        apiKey?: string;
      }
  ) {
    const novitaApiKey =
      fields?.apiKey ||
      fields?.novitaApiKey ||
      getEnvironmentVariable("NOVITA_API_KEY");

    if (!novitaApiKey) {
      throw new Error(
        `Novita API key not found. Please set the NOVITA_API_KEY environment variable or provide the key into "novitaApiKey"`
      );
    }

    super({
      ...fields,
      model: fields?.model || "gryphe/mythomax-l2-13b",
      apiKey: novitaApiKey,
      configuration: {
        baseURL: "https://api.novita.ai/v3/openai/",
      },
    });
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "novita";
    return params;
  }

  toJSON() {
    const result = super.toJSON();

    if (
      "kwargs" in result &&
      typeof result.kwargs === "object" &&
      result.kwargs != null
    ) {
      delete result.kwargs.openai_api_key;
      delete result.kwargs.configuration;
    }

    return result;
  }

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<OpenAIClient.Chat.Completions.ChatCompletion>;

  async completionWithRetry(
    request:
      | OpenAIClient.Chat.ChatCompletionCreateParamsStreaming
      | OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>
    | OpenAIClient.Chat.Completions.ChatCompletion
  > {
    delete request.frequency_penalty;
    delete request.presence_penalty;
    delete request.logit_bias;
    delete request.functions;

    if (request.stream === true) {
      return super.completionWithRetry(request, options);
    }

    return super.completionWithRetry(request, options);
  }
}
