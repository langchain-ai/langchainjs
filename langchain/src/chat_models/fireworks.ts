import { ChatOpenAI } from "./openai.js";
import type { BaseChatModelParams } from "./base.js";
import type { ChatOpenAICallOptions, OpenAIChatInput } from "./openai.js";
import { getEnvironmentVariable } from "../util/env.js";

type FireworksUnsupportedArgs =
  | "frequencyPenalty"
  | "presencePenalty"
  | "bestOf"
  | "logitBias"
  | "functions";

type FireworksUnsupportedCallOptions = "functions" | "function_call" | "tools";

export class ChatFireworks extends ChatOpenAI {
  static lc_name() {
    return "ChatFireworks";
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
    fields: Partial<
      Omit<OpenAIChatInput, "openAIApiKey" | FireworksUnsupportedArgs>
    > &
      BaseChatModelParams & { fireworksApiKey?: string }
  ) {
    const fireworksApiKey =
      fields.fireworksApiKey || getEnvironmentVariable("FIREWORKS_API_KEY");

    if (!fireworksApiKey) {
      throw new Error(
        `Fireworks API key not found. Please set the FIREWORKS_API_KEY environment variable or provide the key into "fireworksApiKey"`
      );
    }

    super({
      ...fields,
      modelName:
        fields.modelName || "accounts/fireworks/models/llama-v2-13b-chat",
      openAIApiKey: fireworksApiKey,
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

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error TODO: fix wrong response type
  async completionWithRetry(request, options) {
    // https://readme.fireworks.ai/docs/openai-compatibility#api-compatibility
    if (Array.isArray(request.prompt)) {
      if (request.prompt.length > 1) {
        throw new Error("Multiple prompts are not supported by Fireworks");
      }
      [request.prompt] = request.prompt;
    }

    delete request.frequency_penalty;
    delete request.presence_penalty;
    delete request.best_of;
    delete request.logit_bias;
    delete request.functions;

    return super.completionWithRetry(request, options);
  }

  bind(
    kwargs: Partial<
      Omit<ChatOpenAICallOptions, FireworksUnsupportedCallOptions>
    >
  ) {
    return super.bind(kwargs);
  }
}
