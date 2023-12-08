import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";

const apiUrl = "https://llm.api.cloud.yandex.net/llm/v1alpha/instruct";

export interface YandexGPTInputs extends BaseLLMParams {
  /**
   * What sampling temperature to use.
   * Should be a double number between 0 (inclusive) and 1 (inclusive).
   */
  temperature?: number;

  /**
   * Maximum limit on the total number of tokens
   * used for both the input prompt and the generated response.
   */
  maxTokens?: number;

  /** Model name to use. */
  model?: string;

  /**
   * Yandex Cloud Api Key for service account
   * with the `ai.languageModels.user` role.
   */
  apiKey?: string;

  /**
   * Yandex Cloud IAM token for service account
   * with the `ai.languageModels.user` role.
   */
  iamToken?: string;
}

export class YandexGPT extends LLM implements YandexGPTInputs {
  lc_serializable = true;

  static lc_name() {
    return "Yandex GPT";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "YC_API_KEY",
      iamToken: "YC_IAM_TOKEN",
    };
  }

  temperature = 0.6;

  maxTokens = 1700;

  model = "general";

  apiKey?: string;

  iamToken?: string;

  constructor(fields?: YandexGPTInputs) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("YC_API_KEY");

    const iamToken = fields?.iamToken ?? getEnvironmentVariable("YC_IAM_TOKEN");

    if (apiKey === undefined && iamToken === undefined) {
      throw new Error(
        "Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field."
      );
    }

    this.apiKey = apiKey;
    this.iamToken = iamToken;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "yandexgpt";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    // Hit the `generate` endpoint on the `large` model
    return this.caller.callWithOptions({ signal: options.signal }, async () => {
      const headers = { "Content-Type": "application/json", Authorization: "" };
      if (this.apiKey !== undefined) {
        headers.Authorization = `Api-Key ${this.apiKey}`;
      } else {
        headers.Authorization = `Bearer ${this.iamToken}`;
      }
      const bodyData = {
        model: this.model,
        generationOptions: {
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        },

        requestText: prompt,
      };

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyData),
        });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${apiUrl} from YandexGPT: ${response.status}`
          );
        }

        const responseData = await response.json();
        return responseData.result.alternatives[0].text;
      } catch (error) {
        throw new Error(`Failed to fetch ${apiUrl} from YandexGPT ${error}`);
      }
    });
  }
}
