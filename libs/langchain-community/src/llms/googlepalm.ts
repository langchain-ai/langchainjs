import { TextServiceClient, protos } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";
import { type BaseLLMParams, LLM } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Input for Text generation for Google Palm
 */
export interface GooglePaLMTextInput extends BaseLLMParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `models/{model}`
   */
  modelName?: string;

  /**
   * Controls the randomness of the output.
   *
   * Values can range from [0.0,1.0], inclusive. A value closer to 1.0
   * will produce responses that are more varied and creative, while
   * a value closer to 0.0 will typically result in more straightforward
   * responses from the model.
   *
   * Note: The default value varies by model
   */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxOutputTokens?: number;

  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   *
   * Note: The default value varies by model
   */
  topP?: number;

  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   *
   * Note: The default value varies by model
   */
  topK?: number;

  /**
   * The set of character sequences (up to 5) that will stop output generation.
   * If specified, the API will stop at the first appearance of a stop
   * sequence.
   *
   * Note: The stop sequence will not be included as part of the response.
   */
  stopSequences?: string[];

  /**
   * A list of unique `SafetySetting` instances for blocking unsafe content. The API will block
   * any prompts and responses that fail to meet the thresholds set by these settings. If there
   * is no `SafetySetting` for a given `SafetyCategory` provided in the list, the API will use
   * the default safety setting for that category.
   */
  safetySettings?: protos.google.ai.generativelanguage.v1beta2.ISafetySetting[];

  /**
   * Google Palm API key to use
   */
  apiKey?: string;
}

/**
 * Google Palm 2 Language Model Wrapper to generate texts
 */
export class GooglePaLM extends LLM implements GooglePaLMTextInput {
  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLE_PALM_API_KEY",
    };
  }

  modelName = "models/text-bison-001";

  temperature?: number; // default value chosen based on model

  maxOutputTokens?: number; // defaults to 64

  topP?: number; // default value chosen based on model

  topK?: number; // default value chosen based on model

  stopSequences: string[] = [];

  safetySettings?: protos.google.ai.generativelanguage.v1beta2.ISafetySetting[]; // default safety setting for that category

  apiKey?: string;

  private client: TextServiceClient;

  constructor(fields?: GooglePaLMTextInput) {
    super(fields ?? {});

    this.modelName = fields?.modelName ?? this.modelName;

    this.temperature = fields?.temperature ?? this.temperature;
    if (this.temperature && (this.temperature < 0 || this.temperature > 1)) {
      throw new Error("`temperature` must be in the range of [0.0,1.0]");
    }

    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    if (this.maxOutputTokens && this.maxOutputTokens < 0) {
      throw new Error("`maxOutputTokens` must be a positive integer");
    }

    this.topP = fields?.topP ?? this.topP;
    if (this.topP && this.topP < 0) {
      throw new Error("`topP` must be a positive integer");
    }

    if (this.topP && this.topP > 1) {
      throw new Error("Google PaLM `topP` must in the range of [0,1]");
    }

    this.topK = fields?.topK ?? this.topK;
    if (this.topK && this.topK < 0) {
      throw new Error("`topK` must be a positive integer");
    }

    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.safetySettings = fields?.safetySettings ?? this.safetySettings;
    if (this.safetySettings && this.safetySettings.length > 0) {
      const safetySettingsSet = new Set(
        this.safetySettings.map((s) => s.category)
      );
      if (safetySettingsSet.size !== this.safetySettings.length) {
        throw new Error(
          "The categories in `safetySettings` array must be unique"
        );
      }
    }

    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable("GOOGLE_PALM_API_KEY");
    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for Google Palm 2 in the environment variable GOOGLE_PALM_API_KEY or in the `apiKey` field of the GooglePalm constructor"
      );
    }

    this.client = new TextServiceClient({
      authClient: new GoogleAuth().fromAPIKey(this.apiKey),
    });
  }

  _llmType(): string {
    return "googlepalm";
  }

  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const res = await this.caller.callWithOptions(
      { signal: options.signal },
      this._generateText.bind(this),
      prompt
    );
    return res ?? "";
  }

  protected async _generateText(
    prompt: string
  ): Promise<string | null | undefined> {
    const res = await this.client.generateText({
      model: this.modelName,
      temperature: this.temperature,
      candidateCount: 1,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
      stopSequences: this.stopSequences,
      safetySettings: this.safetySettings,
      prompt: {
        text: prompt,
      },
    });
    return res[0].candidates && res[0].candidates.length > 0
      ? res[0].candidates[0].output
      : undefined;
  }
}
