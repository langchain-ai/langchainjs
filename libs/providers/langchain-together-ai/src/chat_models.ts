import type {
  BaseChatModelParams,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  type ChatOpenAICallOptions,
  ChatOpenAICompletions,
  type OpenAIChatInput,
  type OpenAICoreRequestOptions,
  type OpenAIClient,
} from "@langchain/openai";

type TogetherAIUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "logitBias"
  | "functions";

type TogetherAIUnsupportedCallOptions = "functions" | "function_call";

export interface ChatTogetherAICallOptions extends Omit<
  ChatOpenAICallOptions,
  TogetherAIUnsupportedCallOptions
> {
  response_format?: {
    type: "json_object";
    schema: Record<string, unknown>;
  };
}

export interface ChatTogetherAIInput
  extends
    Omit<OpenAIChatInput, "openAIApiKey" | TogetherAIUnsupportedArgs>,
    BaseChatModelParams {
  /**
   * The Together AI API key to use for requests.
   * Alias for `apiKey`.
   * @default process.env.TOGETHER_AI_API_KEY
   */
  togetherAIApiKey?: string;
  /**
   * The Together AI API key to use for requests.
   * @default process.env.TOGETHER_AI_API_KEY
   */
  apiKey?: string;
}

/**
 * Together AI chat model integration.
 *
 * The Together AI chat API is OpenAI-compatible with a few unsupported request
 * fields. Full API reference:
 * https://docs.together.ai/reference/chat-completions
 *
 * Setup:
 * Install `@langchain/together-ai` and set an environment variable named
 * `TOGETHER_AI_API_KEY`.
 *
 * ```bash
 * npm install @langchain/together-ai
 * export TOGETHER_AI_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_together_ai.ChatTogetherAI.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/_langchain_together_ai.ChatTogetherAICallOptions.html)
 */
export class ChatTogetherAI extends ChatOpenAICompletions<ChatTogetherAICallOptions> {
  static lc_name() {
    return "ChatTogetherAI";
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "chat_models", "together_ai"];

  _llmType() {
    return "togetherAI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      togetherAIApiKey: "TOGETHER_AI_API_KEY",
      apiKey: "TOGETHER_AI_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      togetherAIApiKey: "together_ai_api_key",
      apiKey: "together_ai_api_key",
    };
  }

  constructor(fields?: Partial<ChatTogetherAIInput>) {
    const togetherAIApiKey =
      fields?.apiKey ||
      fields?.togetherAIApiKey ||
      getEnvironmentVariable("TOGETHER_AI_API_KEY");

    if (!togetherAIApiKey) {
      throw new Error(
        'Together AI API key not found. Please set the TOGETHER_AI_API_KEY environment variable or pass the key into the "apiKey" field.'
      );
    }

    super({
      ...fields,
      model: fields?.model || "mistralai/Mixtral-8x7B-Instruct-v0.1",
      apiKey: togetherAIApiKey,
      configuration: {
        baseURL: "https://api.together.xyz/v1/",
        ...fields?.configuration,
      },
    });
    this._addVersion("@langchain/together-ai", __PKG_VERSION__);
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "together";
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

    return super.completionWithRetry(request, options);
  }
}
