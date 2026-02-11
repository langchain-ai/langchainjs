import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { WebApiClient } from "../clients/index.js";
import {
  BaseChatGoogle,
  BaseChatGoogleCallOptions,
  BaseChatGoogleParams,
  getGoogleChatModelParams,
} from "./base.js";

/**
 * Configuration parameters for the ChatGoogle model.
 *
 * This interface extends the base Google chat model parameters and adds
 * specific configuration options for the Generative AI API.
 */
export interface ChatGoogleParams extends BaseChatGoogleParams {
  /**
   * Google API key for authentication with the Generative AI API.
   *
   * If not provided, the model will attempt to use the `GOOGLE_API_KEY`
   * environment variable. You can obtain an API key from the
   * [Google AI Studio](https://makersuite.google.com/app/apikey).
   */
  apiKey?: string;

  /** @deprecated Import from `@langchain/google/node` to configure google auth options */
  authOptions?: never;
}

/**
 * Call options for the ChatGoogle model.
 *
 * This interface extends the base Google chat model call options and provides
 * configuration for individual model invocations. These options can be passed
 * when calling methods like `invoke()`, `stream()`, or `batch()` to customize
 * the behavior of a specific request.
 */
export interface ChatGoogleCallOptions extends BaseChatGoogleCallOptions {}

export class ChatGoogle extends BaseChatGoogle<ChatGoogleCallOptions> {
  apiKey?: string;

  constructor(model: string, params?: Omit<ChatGoogleParams, "model">);
  constructor(params: ChatGoogleParams);
  constructor(
    modelOrParams: string | ChatGoogleParams,
    paramsArg?: Omit<ChatGoogleParams, "model">
  ) {
    const params = getGoogleChatModelParams(modelOrParams, paramsArg);
    params.apiKey = params?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    const apiClient = params?.apiClient ?? new WebApiClient(params);
    super({ ...params, apiClient });

    this.apiKey = params.apiKey;
  }
}
