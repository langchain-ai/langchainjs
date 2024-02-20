import type { BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import {
  type OpenAIClient,
  type ChatOpenAICallOptions,
  type OpenAIChatInput,
  type OpenAICoreRequestOptions,
  ChatOpenAI,
} from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

type GroqUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "logitBias"
  | "tools"
  | "user"
  | "n"
  | "stop"
  | "function_call"
  | "functions";

type GroqUnsupportedCallOptions = "functions" | "function_call";

export interface ChatGroqCallOptions
  extends Omit<ChatOpenAICallOptions, GroqUnsupportedCallOptions> {}

export interface ChatGroqInput
  extends Omit<OpenAIChatInput, "openAIApiKey" | GroqUnsupportedArgs>,
    BaseChatModelParams {
  /**
   * The Groq API key to use for requests.
   * @default process.env.GROQ_API_KEY
   */
  apiKey?: string;
}

/**
 * Wrapper around Groq API for large language models fine-tuned for chat
 *
 * Groq API is compatible to the OpenAI API with some limitations. View the
 * full API ref at:
 * @link {https://docs.api.groq.com/md/openai.oas.html}
 *
 * To use, you should have the `GROQ_API_KEY` environment variable set.
 * @example
 * ```typescript
 * const model = new ChatGroq({
 *   temperature: 0.9,
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 *
 * const response = await model.invoke([new HumanMessage("Hello there!")]);
 * console.log(response);
 * ```
 */
export class ChatGroq extends ChatOpenAI<ChatGroqCallOptions> {
  static lc_name() {
    return "ChatGroq";
  }

  _llmType() {
    return "groq";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GROQ_API_KEY",
    };
  }

  lc_serializable = true;

  constructor(
    fields?: Partial<
      Omit<OpenAIChatInput, "openAIApiKey" | GroqUnsupportedArgs>
    > &
      BaseChatModelParams & { apiKey?: string }
  ) {
    const apiKey =
      fields?.apiKey || getEnvironmentVariable("GROQ_API_KEY");

    if (!apiKey) {
      throw new Error(
        `Groq API key not found. Please set the GROQ_API_KEY environment variable or provide the key into "apiKey"`
      );
    }

    super({
      ...fields,
      modelName: fields?.modelName || "llama2-70b-4096",
      openAIApiKey: apiKey,
      configuration: {
        baseURL: "https://api.groq.com/openai/v1/",
      },
    });
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
   * Calls the Groq API with retry logic in case of failures.
   * @param request The request to send to the Groq API.
   * @param options Optional configuration for the API call.
   * @returns The response from the Groq API.
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
    console.log(request, options)
    return super.completionWithRetry(request, options);
  }
}
