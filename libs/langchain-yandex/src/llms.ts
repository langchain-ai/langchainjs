import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";

const apiUrl =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

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

  /** Model version to use. */
  modelVersion?: string;

  /** Model URI to use. */
  modelURI?: string;

  /**
   * Yandex Cloud Folder ID
   */
  folderID?: string;

  /**
   * Yandex Cloud Api Key for service account
   * with the `ai.languageModels.user` role.
   */
  apiKey?: string;

  /**
   * Yandex Cloud IAM token for service or user account
   * with the `ai.languageModels.user` role.
   */
  iamToken?: string;
}

export class YandexGPT extends LLM implements YandexGPTInputs {
  lc_serializable = true;

  static lc_name() {
    return "YandexGPT";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "YC_API_KEY",
      iamToken: "YC_IAM_TOKEN",
      folderID: "YC_FOLDER_ID",
    };
  }

  temperature = 0.6;

  maxTokens = 1700;

  model = "yandexgpt-lite";

  modelVersion = "latest";

  modelURI?: string;

  apiKey?: string;

  iamToken?: string;

  folderID?: string;

  constructor(fields?: YandexGPTInputs) {
    super(fields ?? {});
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("YC_API_KEY");

    const iamToken = fields?.iamToken ?? getEnvironmentVariable("YC_IAM_TOKEN");

    const folderID = fields?.folderID ?? getEnvironmentVariable("YC_FOLDER_ID");

    if (apiKey === undefined && iamToken === undefined) {
      throw new Error(
        "Please set the YC_API_KEY or YC_IAM_TOKEN environment variable or pass it to the constructor as the apiKey or iamToken field."
      );
    }

    this.modelURI = fields?.modelURI;
    this.apiKey = apiKey;
    this.iamToken = iamToken;
    this.folderID = folderID;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
    this.modelVersion = fields?.modelVersion ?? this.modelVersion;

    if (this.modelURI === undefined && folderID === undefined) {
      throw new Error(
        "Please set the YC_FOLDER_ID environment variable or pass Yandex GPT model URI to the constructor as the modelURI field."
      );
    }

    if (!this.modelURI) {
      this.modelURI = `gpt://${this.folderID}/${this.model}/${this.modelVersion}`;
    }
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
      const headers = {
        "Content-Type": "application/json",
        Authorization: "",
        "x-folder-id": "",
      };
      if (this.apiKey !== undefined) {
        headers.Authorization = `Api-Key ${this.apiKey}`;
      } else {
        headers.Authorization = `Bearer ${this.iamToken}`;
        if (this.folderID !== undefined) {
          headers["x-folder-id"] = this.folderID;
        }
      }
      const bodyData = {
        modelUri: this.modelURI,
        completionOptions: {
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        },

        messages: [{ role: "user", text: prompt }],
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
        return responseData.result.alternatives[0].message.text;
      } catch (error) {
        throw new Error(`Failed to fetch ${apiUrl} from YandexGPT ${error}`);
      }
    });
  }
}
