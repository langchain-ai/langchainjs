import type {
  BaseChatModelParams,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  ChatOpenAICompletions,
  type ChatOpenAICallOptions,
  type OpenAIChatInput,
  type OpenAIClient,
  type OpenAICoreRequestOptions,
} from "@langchain/openai";

const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
const DEFAULT_FIREWORKS_CHAT_MODEL =
  "accounts/fireworks/models/llama-v3p1-8b-instruct";

type FireworksUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "logitBias"
  | "functions";

type FireworksUnsupportedCallOptions = "functions" | "function_call";

export interface ChatFireworksInput
  extends
    Partial<Omit<OpenAIChatInput, "openAIApiKey" | FireworksUnsupportedArgs>>,
    BaseChatModelParams {
  /**
   * Prefer `apiKey`.
   */
  fireworksApiKey?: string;

  /**
   * The Fireworks API key to use.
   */
  apiKey?: string;
}

export type ChatFireworksCallOptions = Partial<
  Omit<ChatOpenAICallOptions, FireworksUnsupportedCallOptions>
>;

/**
 * Fireworks chat model integration.
 *
 * The Fireworks chat API is OpenAI-compatible with a smaller supported
 * parameter surface than the upstream OpenAI endpoints.
 *
 * Setup:
 *
 * ```bash
 * npm install @langchain/fireworks @langchain/core
 * export FIREWORKS_API_KEY="your-api-key"
 * ```
 *
 * @example
 * ```typescript
 * import { ChatFireworks } from "@langchain/fireworks";
 *
 * const model = new ChatFireworks({
 *   model: "accounts/fireworks/models/firefunction-v2",
 *   temperature: 0,
 * });
 *
 * const response = await model.invoke("Tell me a short joke about fireworks.");
 * ```
 */
export class ChatFireworks extends ChatOpenAICompletions<ChatFireworksCallOptions> {
  static lc_name() {
    return "ChatFireworks";
  }

  lc_namespace = ["langchain", "chat_models", "fireworks"];

  lc_serializable = true;

  fireworksApiKey?: string;

  apiKey?: string;

  constructor(model: string, fields?: Omit<ChatFireworksInput, "model">);
  constructor(fields?: ChatFireworksInput);
  constructor(
    modelOrFields?: string | ChatFireworksInput,
    fieldsArg?: Omit<ChatFireworksInput, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(fieldsArg ?? {}), model: modelOrFields }
        : (modelOrFields ?? {});

    const fireworksApiKey =
      fields.apiKey ||
      fields.fireworksApiKey ||
      getEnvironmentVariable("FIREWORKS_API_KEY");

    if (!fireworksApiKey) {
      throw new Error(
        'Fireworks API key not found. Please set the FIREWORKS_API_KEY environment variable or pass the key into "apiKey" or "fireworksApiKey".'
      );
    }

    super({
      ...fields,
      model: fields.model ?? fields.modelName ?? DEFAULT_FIREWORKS_CHAT_MODEL,
      apiKey: fireworksApiKey,
      configuration: {
        baseURL: FIREWORKS_BASE_URL,
        ...fields.configuration,
      },
      streamUsage: false,
    });

    this.fireworksApiKey = fireworksApiKey;
    this.apiKey = fireworksApiKey;
    this._addVersion("@langchain/fireworks", __PKG_VERSION__);
  }

  _llmType() {
    return "fireworks";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      fireworksApiKey: "FIREWORKS_API_KEY",
      apiKey: "FIREWORKS_API_KEY",
    };
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "fireworks";
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

export { FIREWORKS_BASE_URL, DEFAULT_FIREWORKS_CHAT_MODEL };
