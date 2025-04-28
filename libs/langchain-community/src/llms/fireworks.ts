import {
  type OpenAIClient,
  type OpenAICallOptions,
  type OpenAIInput,
  type OpenAICoreRequestOptions,
  OpenAI,
} from "@langchain/openai";
import type { BaseLLMParams } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

type FireworksUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "bestOf"
  | "logitBias";

type FireworksUnsupportedCallOptions = "functions" | "function_call" | "tools";

export type FireworksCallOptions = Partial<
  Omit<OpenAICallOptions, FireworksUnsupportedCallOptions>
>;

/**
 * Wrapper around Fireworks API for large language models
 *
 * Fireworks API is compatible to the OpenAI API with some limitations described in
 * https://readme.fireworks.ai/docs/openai-compatibility.
 *
 * To use, you should have the `openai` package installed and
 * the `FIREWORKS_API_KEY` environment variable set.
 */
export class Fireworks extends OpenAI<FireworksCallOptions> {
  static lc_name() {
    return "Fireworks";
  }

  _llmType() {
    return "fireworks";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      fireworksApiKey: "FIREWORKS_API_KEY",
    };
  }

  lc_serializable = true;

  fireworksApiKey?: string;

  constructor(
    fields?: Partial<
      Omit<OpenAIInput, "openAIApiKey" | FireworksUnsupportedArgs>
    > &
      BaseLLMParams & { fireworksApiKey?: string }
  ) {
    const fireworksApiKey =
      fields?.fireworksApiKey || getEnvironmentVariable("FIREWORKS_API_KEY");

    if (!fireworksApiKey) {
      throw new Error(
        `Fireworks API key not found. Please set the FIREWORKS_API_KEY environment variable or provide the key into "fireworksApiKey"`
      );
    }

    super({
      ...fields,
      openAIApiKey: fireworksApiKey,
      modelName: fields?.modelName || "accounts/fireworks/models/llama-v2-13b",
      configuration: {
        baseURL: "https://api.fireworks.ai/inference/v1",
      },
    });

    this.fireworksApiKey = fireworksApiKey;
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

  /**
   * Calls the Fireworks API with retry logic in case of failures.
   * @param request The request to send to the Fireworks API.
   * @param options Optional configuration for the API call.
   * @returns The response from the Fireworks API.
   */
  async completionWithRetry(
    request:
      | OpenAIClient.CompletionCreateParamsStreaming
      | OpenAIClient.CompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<
    AsyncIterable<OpenAIClient.Completion> | OpenAIClient.Completions.Completion
  > {
    // https://readme.fireworks.ai/docs/openai-compatibility#api-compatibility
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

    if (request.stream === true) {
      return super.completionWithRetry(request, options);
    }

    return super.completionWithRetry(request, options);
  }
}
