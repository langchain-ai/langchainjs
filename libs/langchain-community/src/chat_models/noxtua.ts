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

type NoxtuaUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "logitBias"
  | "functions";

type NoxtuaUnsupportedCallOptions = "functions" | "function_call";

export type ChatNoxtuaCallOptions = Partial<
  Omit<ChatOpenAICallOptions, NoxtuaUnsupportedCallOptions>
>;

export class ChatNoxtua extends ChatOpenAI<ChatNoxtuaCallOptions> {
  static lc_name() {
    return "ChatNoxtua";
  }

  _llmType() {
    return "noxtua";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      noxtuaApiKey: "NOXTUA_API_KEY",
      apiKey: "NOXTUA_API_KEY",
    };
  }

  lc_serializable = true;

  tenantId?: string;

  noxtuaApiKey?: string;

  apiKey?: string;

  constructor(
    fields?: Partial<
      Omit<OpenAIChatInput, "openAIApiKey" | NoxtuaUnsupportedArgs>
    > &
      BaseChatModelParams & {
        tenantId: string;
        /**
         * Prefer `apiKey`
         */
        noxtuaApiKey?: string;
        /**
         * The Noxtua API key to use.
         */
        apiKey?: string;
      }
  ) {
    const tenantId =
      fields?.tenantId || getEnvironmentVariable("NOXTUA_TENANT_ID");
    const noxtuaApiKey =
      fields?.apiKey ||
      fields?.noxtuaApiKey ||
      getEnvironmentVariable("NOXTUA_API_KEY");

    if (!tenantId) {
      throw new Error(
        `Noxtua tenantId not found. Please set the NOXTUA_TENANT_ID environment variable or provide the key into "tenantId"`
      );
    }

    if (!noxtuaApiKey) {
      throw new Error(
        `Noxtua API key not found. Please set the NOXTUA_API_KEY environment variable or provide the key into "noxtuaApiKey"`
      );
    }

    super({
      defaultHeaders: {
        "tenant-id": tenantId,
        Authorization: `Bearer ${noxtuaApiKey}`,
      },
      configuration: {
        baseURL: "https://kong.noxtua.ai/v2/api",
      },
      streamUsage: true,
    });

    this.tenantId = tenantId;
    this.noxtuaApiKey = noxtuaApiKey;
    this.apiKey = noxtuaApiKey;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "xayn";
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
   * Calls the Fireworks API with retry logic in case of failures.
   * @param request The request to send to the Fireworks API.
   * @param options Optional configuration for the API call.
   * @returns The response from the Fireworks API.
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
