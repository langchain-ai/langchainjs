import type {
  BaseChatModelParams,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import {
  type OpenAIClient,
  type ChatOpenAICallOptions,
  type OpenAIChatInput,
  type OpenAICoreRequestOptions,
  ChatOpenAI,
} from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

type TogetherAIUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "logitBias"
  | "functions";

type TogetherAIUnsupportedCallOptions = "functions" | "function_call";

export interface ChatTogetherAICallOptions
  extends Omit<ChatOpenAICallOptions, TogetherAIUnsupportedCallOptions> {
  response_format: {
    type: "json_object";
    schema: Record<string, unknown>;
  };
}

export interface ChatTogetherAIInput
  extends Omit<OpenAIChatInput, "openAIApiKey" | TogetherAIUnsupportedArgs>,
    BaseChatModelParams {
  /**
   * The TogetherAI API key to use for requests.
   * Alias for `apiKey`
   * @default process.env.TOGETHER_AI_API_KEY
   */
  togetherAIApiKey?: string;
  /**
   * The TogetherAI API key to use for requests.
   * @default process.env.TOGETHER_AI_API_KEY
   */
  apiKey?: string;
}

/**
 * Wrapper around TogetherAI API for large language models fine-tuned for chat
 *
 * TogetherAI API is compatible to the OpenAI API with some limitations. View the
 * full API ref at:
 * @link {https://docs.together.ai/reference/chat-completions}
 *
 * To use, you should have the `TOGETHER_AI_API_KEY` environment variable set.
 * @example
 * ```typescript
 * const model = new ChatTogetherAI({
 *   temperature: 0.9,
 *   apiKey: process.env.TOGETHER_AI_API_KEY,
 * });
 *
 * const response = await model.invoke([new HumanMessage("Hello there!")]);
 * console.log(response);
 * ```
 */
export class ChatTogetherAI extends ChatOpenAI<ChatTogetherAICallOptions> {
  static lc_name() {
    return "ChatTogetherAI";
  }

  _llmType() {
    return "togetherAI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      togetherAIApiKey: "TOGETHER_AI_API_KEY",
      apiKey: "TOGETHER_AI_API_KEY",
    };
  }

  lc_serializable = true;

  constructor(
    fields?: Partial<
      Omit<OpenAIChatInput, "openAIApiKey" | TogetherAIUnsupportedArgs>
    > &
      BaseChatModelParams & {
        /**
         * Prefer `apiKey`
         */
        togetherAIApiKey?: string;
        /**
         * The TogetherAI API key to use.
         */
        apiKey?: string;
      }
  ) {
    const togetherAIApiKey =
      fields?.apiKey ||
      fields?.togetherAIApiKey ||
      getEnvironmentVariable("TOGETHER_AI_API_KEY");

    if (!togetherAIApiKey) {
      throw new Error(
        `TogetherAI API key not found. Please set the TOGETHER_AI_API_KEY environment variable or provide the key into "togetherAIApiKey"`
      );
    }

    super({
      ...fields,
      model: fields?.model || "mistralai/Mixtral-8x7B-Instruct-v0.1",
      apiKey: togetherAIApiKey,
      configuration: {
        baseURL: "https://api.together.xyz/v1/",
      },
    });
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

  /**
   * Calls the TogetherAI API with retry logic in case of failures.
   * @param request The request to send to the TogetherAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the TogetherAI API.
   */
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
