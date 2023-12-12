import {
  EnhancedGenerateContentResponse,
  GenerativeModel,
  GoogleGenerativeAI as GenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  Part,
  SafetySetting,
} from "@google/generative-ai";
import { TextServiceClient, protos } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";

import { BaseLanguageModelInput } from "@langchain/core/language_models/base";

import { GenerationChunk } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  assertSafetySettings,
  convertInput,
} from "../utils/googlegenerativeai.js";

import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";

export type { HarmCategory, HarmBlockThreshold, SafetySetting };
/**
 * Input for Text generation for Google Generative AI
 */
export interface GoogleGenerativeAITextInput extends BaseLLMParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `{model}`
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
  safetySettings?:
    | SafetySetting[]
    | protos.google.ai.generativelanguage.v1beta2.ISafetySetting[];

  /**
   * Google Palm API key to use
   */
  apiKey?: string;
}

/**
 * Google Generative AI Models Wrapper to generate texts
 */
export class GoogleGenerativeAI
  extends LLM
  implements GoogleGenerativeAITextInput
{
  static lc_name() {
    return "googlegenerativeai";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLE_API_KEY",
    };
  }

  modelName = "gemini-pro";

  temperature?: number; // default value chosen based on model

  maxOutputTokens?: number;

  topP?: number; // default value chosen based on model

  topK?: number; // default value chosen based on model

  stopSequences: string[] = [];

  safetySettings?:
    | SafetySetting[]
    | protos.google.ai.generativelanguage.v1beta2.ISafetySetting[];

  apiKey?: string;

  private client: GenerativeModel | TextServiceClient;

  get _isGenerateContentModel() {
    if (/^gemini/.test(this.modelName)) {
      return true;
    }
    return false;
  }

  constructor(fields?: GoogleGenerativeAITextInput) {
    super(fields ?? {});

    this.modelName =
      fields?.modelName?.replace(/^models\//, "") ?? this.modelName;

    const isGenerateContentModel = this._isGenerateContentModel;

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
      throw new Error("`topP` must in the range of [0,1]");
    }

    this.topK = fields?.topK ?? this.topK;
    if (this.topK && this.topK < 0) {
      throw new Error("`topK` must be a positive integer");
    }

    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for Google GenerativeAI " +
          "in the environmentb variable GOOGLE_API_KEY " +
          "or in the `apiKey` field of the " +
          "GoogleGenerativeAI constructor"
      );
    }

    this.safetySettings = fields?.safetySettings ?? this.safetySettings;
    if (this.safetySettings && this.safetySettings.length > 0) {
      if (isGenerateContentModel) {
        assertSafetySettings(
          this.safetySettings as SafetySetting[],
          HarmCategory,
          HarmBlockThreshold
        );
      } else {
        assertSafetySettings(
          this
            .safetySettings as protos.google.ai.generativelanguage.v1beta2.ISafetySetting[],
          protos.google.ai.generativelanguage.v1beta2.HarmCategory,
          protos.google.ai.generativelanguage.v1beta2.SafetySetting
            .HarmBlockThreshold
        );
      }
    }

    this.client = isGenerateContentModel
      ? new GenerativeAI(this.apiKey).getGenerativeModel({
          model: this.modelName,
          safetySettings: this.safetySettings as SafetySetting[],
          generationConfig: {
            candidateCount: 1,
            stopSequences: this.stopSequences,
            maxOutputTokens: this.maxOutputTokens,
            temperature: this.temperature,
            topP: this.topP,
            topK: this.topK,
          },
        })
      : new TextServiceClient({
          authClient: new GoogleAuth().fromAPIKey(this.apiKey),
        });
  }

  _llmType(): string {
    return "googlegenerativeai";
  }

  /**
   * Count tokens.
   * @param input BaseLanguageModelInput - text or multimodal
   * @returns Number of tokens
   */

  async countTokens(
    input: BaseLanguageModelInput,
    options?: this["ParsedCallOptions"]
  ): Promise<number> {
    if (!this._isGenerateContentModel) {
      throw new Error(
        `countTokens is not implemented for ${this.modelName} model`
      );
    }
    const convertedInput = this._convertInputToGenerateContent(input);
    const res = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        const output = await (this.client as GenerativeModel).countTokens(
          convertedInput
        );
        return output;
      }
    );
    return res.totalTokens;
  }

  _convertInputToGenerateContent(input: BaseLanguageModelInput): Part[] {
    return convertInput(input, this.modelName.includes("vision"));
  }

  _generateContentResponseToText(response: EnhancedGenerateContentResponse) {
    if (!response.candidates) {
      return "";
    }
    const [message] = response.candidates;
    const text = message.content.parts
      .map((part) => part.text)
      .filter(Boolean)
      .flat(1)
      .join(" ");
    return text ?? "";
  }

  async invoke(
    input: BaseLanguageModelInput,
    options?: this["ParsedCallOptions"]
  ) {
    if (this._isGenerateContentModel) {
      return super.invoke(input, options);
    }
    let prompt = this._convertInputToGenerateContent(input);
    const res = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => {
        const output = await (this.client as GenerativeModel).generateContent(
          prompt
        );
        return output;
      }
    );
    return this._generateContentResponseToText(res.response);
  }

  protected async _generateText(
    prompt: string
  ): Promise<string | null | undefined> {
    const res = await (this.client as TextServiceClient).generateText({
      model: this.modelName,
      temperature: this.temperature,
      candidateCount: 1,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
      stopSequences: this.stopSequences,
      safetySettings: this
        .safetySettings as protos.google.ai.generativelanguage.v1beta2.ISafetySetting[],
      prompt: {
        text: prompt,
      },
    });
    return res[0].candidates && res[0].candidates.length > 0
      ? res[0].candidates[0].output
      : undefined;
  }

  async _call(
    input: string,
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    if (!this._isGenerateContentModel) {
      const res = await this.caller.callWithOptions(
        { signal: options.signal },
        this._generateText.bind(this),
        input
      );
      return res ?? "";
    }
    const prompt = this._convertInputToGenerateContent(input);
    const res = await this.caller.callWithOptions(
      { signal: options.signal },
      async () => {
        const output = await (this.client as GenerativeModel).generateContent(
          prompt
        );
        return output;
      }
    );
    return this._generateContentResponseToText(res.response);
  }

  // TODO: streaming on multi-modal
  async *_streamResponseChunks(
    input: string,
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    if (!this._isGenerateContentModel) {
      throw new Error(
        `Streaming is not supported for the model ${this.modelName}`
      );
    }
    let prompt = this._convertInputToGenerateContent(input);

    const { stream } = await this.caller.callWithOptions(
      { signal: options.signal },
      async () => {
        const output = await (
          this.client as GenerativeModel
        ).generateContentStream(prompt);
        return output;
      }
    );

    for await (const response of stream) {
      if (!response.candidates || response.candidates.length === 0) {
        continue;
      }

      const text = this._generateContentResponseToText(response);

      const chunk = new GenerationChunk({
        text,
        generationInfo: response.promptFeedback,
      });
      yield chunk;
    }
  }
}
