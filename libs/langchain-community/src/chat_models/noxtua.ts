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

export interface ChatNoxtuaCallOptions
  extends Omit<ChatOpenAICallOptions, NoxtuaUnsupportedCallOptions> {
  response_format: {
    type: "json_object";
    schema: Record<string, unknown>;
  };
}

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

  apiUrl?: string;

  apiKey?: string;

  authToken?: string;

  constructor(
    fields?: Partial<
      Omit<OpenAIChatInput, "openAIApiKey" | NoxtuaUnsupportedArgs>
    > &
      BaseChatModelParams & {
        tenantId?: string;
        noxtuaApiUrl?: string;
        apiUrl?: string;
        noxtuaApiKey?: string;
        apiKey?: string;
        noxtuaAuthToken?: string;
        authToken?: string;
      }
  ) {
    const tenantId =
      fields?.tenantId || getEnvironmentVariable("NOXTUA_TENANT_ID");
    const noxtuaApiUrl =
      fields?.apiUrl ||
      fields?.noxtuaApiUrl ||
      getEnvironmentVariable("NOXTUA_API_URL");
    const noxtuaApiKey =
      fields?.apiKey ||
      fields?.noxtuaApiKey ||
      getEnvironmentVariable("NOXTUA_API_KEY");
    const noxtuaAuthToken =
      fields?.authToken ||
      fields?.noxtuaAuthToken ||
      getEnvironmentVariable("NOXTUA_AUTH_TOKEN");
    const defaultHeaders: { [key: string]: string } = {};

    if (tenantId) {
      defaultHeaders["tenant-id"] = tenantId;
    }

    if (noxtuaApiKey) {
      defaultHeaders["x-api-key"] = noxtuaApiKey;
    }

    if (noxtuaAuthToken) {
      defaultHeaders["Authorization"] = `Bearer ${noxtuaAuthToken}`;
    }

    super({
      ...fields,
      configuration: {
        baseURL: noxtuaApiUrl,
        defaultHeaders: {
          "tenant-id": tenantId,
          "x-api-key": noxtuaApiKey,
          Authorization: `Bearer ${noxtuaAuthToken}`,
        },
      },
      streamUsage: true,
    });

    this.tenantId = tenantId;
    this.apiKey = noxtuaApiKey;
    this.apiUrl = noxtuaApiUrl;
    this.authToken = noxtuaAuthToken;
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
