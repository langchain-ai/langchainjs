import type { BaseLLMParams } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  OpenAI,
  type OpenAICallOptions,
  type OpenAIClient,
  type OpenAICoreRequestOptions,
  type OpenAIInput,
} from "@langchain/openai";

const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
const DEFAULT_FIREWORKS_LLM_MODEL = "accounts/fireworks/models/llama-v2-13b";

type FireworksUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "bestOf"
  | "logitBias";

type FireworksUnsupportedCallOptions = "functions" | "function_call" | "tools";

export interface FireworksInput
  extends
    Partial<Omit<OpenAIInput, "openAIApiKey" | FireworksUnsupportedArgs>>,
    BaseLLMParams {
  /**
   * Prefer `apiKey`.
   */
  fireworksApiKey?: string;

  /**
   * The Fireworks API key to use.
   */
  apiKey?: string;
}

export type FireworksCallOptions = Partial<
  Omit<OpenAICallOptions, FireworksUnsupportedCallOptions>
>;

/**
 * Fireworks text completion LLM.
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
 * import { Fireworks } from "@langchain/fireworks";
 *
 * const model = new Fireworks({
 *   temperature: 0,
 * });
 *
 * const response = await model.invoke("1 + 1 =");
 * ```
 */
export class Fireworks extends OpenAI<FireworksCallOptions> {
  static lc_name() {
    return "Fireworks";
  }

  lc_namespace = ["langchain", "llms", "fireworks"];

  lc_serializable = true;

  fireworksApiKey?: string;

  apiKey?: string;

  constructor(
    model: string,
    fields?: Omit<FireworksInput, "model" | "modelName">
  );
  constructor(fields?: FireworksInput);
  constructor(
    modelOrFields?: string | FireworksInput,
    fieldsArg?: Omit<FireworksInput, "model" | "modelName">
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
      apiKey: fireworksApiKey,
      model: fields.model ?? fields.modelName ?? DEFAULT_FIREWORKS_LLM_MODEL,
      configuration: {
        baseURL: FIREWORKS_BASE_URL,
        ...fields.configuration,
      },
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
    request: OpenAIClient.CompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Completion>>;

  async completionWithRetry(
    request: OpenAIClient.CompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<OpenAIClient.Completions.Completion>;

  async completionWithRetry(
    request:
      | OpenAIClient.CompletionCreateParamsStreaming
      | OpenAIClient.CompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<
    AsyncIterable<OpenAIClient.Completion> | OpenAIClient.Completions.Completion
  > {
    if (Array.isArray(request.prompt)) {
      if (request.prompt.length > 1) {
        throw new Error("Multiple prompts are not supported by Fireworks");
      }

      const prompt = request.prompt[0];
      if (typeof prompt !== "string") {
        throw new Error("Only string prompts are supported by Fireworks");
      }

      request.prompt = prompt;
    }

    delete request.frequency_penalty;
    delete request.presence_penalty;
    delete request.best_of;
    delete request.logit_bias;

    return super.completionWithRetry(request, options);
  }
}
