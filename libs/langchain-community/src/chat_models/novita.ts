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

export interface ChatNovitaInput
  extends Omit<OpenAIChatInput, "openAIApiKey">,
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
      Omit<OpenAIChatInput, "openAIApiKey">
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
      model: fields?.model || "qwen/qwen-2.5-72b-instruct",
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
    if (request.response_format) {
      if (request.response_format.type === "json_object") {
        request.response_format = {
          type: "json_object",
        };
      } else if ('json_schema' in request.response_format) {
        const json_schema = request.response_format.json_schema;
        request.response_format = {
          type: "json_schema",
          json_schema,
        };
      }
    }

    if (!request.model) {
      request.model = "qwen/qwen-2.5-72b-instruct";
    }

    try {
      if (request.stream === true) {
        return super.completionWithRetry(request, options);
      }

      return super.completionWithRetry(request, options);
    } catch (error: any) {
      console.error("Novita API call failed:", error.message || error);
      throw error;
    }
  }
}
