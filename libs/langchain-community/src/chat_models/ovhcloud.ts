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

type OVHCloudUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "logitBias"
  | "functions";

type OVHCloudUnsupportedCallOptions = "functions" | "function_call";

export type ChatOVHCloudAIEndpointsCallOptions = Partial<
  Omit<ChatOpenAICallOptions, OVHCloudUnsupportedCallOptions>
>;

export interface ChatOVHCloudAIEndpointsInput
  extends Omit<OpenAIChatInput, "openAIApiKey" | OVHCloudUnsupportedArgs>,
    BaseChatModelParams {
  /**
   * The OVHcloud API key to use for requests.
   * @default process.env.OVHCLOUD_AI_ENDPOINTS_API_KEY
   */
  apiKey?: string;
}

/**
 * OVHcloud AI Endpoints chat model integration.
 *
 * OVHcloud AI Endpoints is compatible with the OpenAI API.
 * Base URL: https://oai.endpoints.kepler.ai.cloud.ovh.net/v1
 *
 * Setup:
 * Install `@langchain/community` and set an environment variable named `OVHCLOUD_AI_ENDPOINTS_API_KEY`.
 * If no API key is provided, the model can still be used but with a rate limit.
 *
 * ```bash
 * npm install @langchain/community
 * export OVHCLOUD_AI_ENDPOINTS_API_KEY="your-api-key"
 * ```
 *
 * ## Constructor args
 *
 * ## Runtime args
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`, `.stream`, etc.
 */
export class ChatOVHCloudAIEndpoints extends ChatOpenAICompletions<ChatOVHCloudAIEndpointsCallOptions> {
  static lc_name() {
    return "ChatOVHCloudAIEndpoints";
  }

  _llmType() {
    return "ovhcloud";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "OVHCLOUD_AI_ENDPOINTS_API_KEY",
    };
  }

  lc_serializable = true;

  constructor(
    fields?: Partial<
      Omit<OpenAIChatInput, "openAIApiKey" | OVHCloudUnsupportedArgs>
    > &
      BaseChatModelParams & {
        /**
         * The OVHcloud AI Endpoints API key to use.
         */
        apiKey?: string;
      }
  ) {
    const apiKey =
      fields?.apiKey || getEnvironmentVariable("OVHCLOUD_AI_ENDPOINTS_API_KEY");

    if (!apiKey) {
      console.warn(
        "OVHcloud AI Endpoints API key not found. You can use the model but with a rate limit. " +
          "Set the OVHCLOUD_AI_ENDPOINTS_API_KEY environment variable or provide the key via 'apiKey' for unlimited access."
      );
    }

    super({
      ...fields,
      apiKey: apiKey || "",
      configuration: {
        baseURL: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getLsParams(options: any): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "ovhcloud";
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
    // Remove arguments not supported by OVHcloud AI Endpoints endpoint
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
