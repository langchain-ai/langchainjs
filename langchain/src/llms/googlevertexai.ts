import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";
import { BaseLLM } from "./base.js";
import { Generation, LLMResult } from "../schema/index.js";
import { GoogleVertexAILLMConnection } from "../util/googlevertexai-connection.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAILLMResponse,
  GoogleVertexAIModelParams,
} from "../types/googlevertexai-types.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";

/**
 * Interface representing the input to the Google Vertex AI model.
 */
export interface GoogleVertexAITextInput
  extends GoogleVertexAIBaseLLMInput<GoogleAuthOptions> {}

/**
 * Interface representing the instance of text input to the Google Vertex
 * AI model.
 */
interface GoogleVertexAILLMTextInstance {
  content: string;
}

/**
 * Interface representing the instance of code input to the Google Vertex
 * AI model.
 */
interface GoogleVertexAILLMCodeInstance {
  prefix: string;
}

/**
 * Type representing an instance of either text or code input to the
 * Google Vertex AI model.
 */
type GoogleVertexAILLMInstance =
  | GoogleVertexAILLMTextInstance
  | GoogleVertexAILLMCodeInstance;

/**
 * Models the data returned from the API call
 */
interface TextPrediction extends GoogleVertexAIBasePrediction {
  content: string;
}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models.
 *
 * To use, you will need to have one of the following authentication
 * methods in place:
 * - You are logged into an account permitted to the Google Cloud project
 *   using Vertex AI.
 * - You are running this on a machine using a service account permitted to
 *   the Google Cloud project using Vertex AI.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the
 *   Google Cloud project using Vertex AI.
 */
export class GoogleVertexAI extends BaseLLM implements GoogleVertexAITextInput {
  model = "text-bison";

  temperature = 0.7;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  private connection: GoogleVertexAILLMConnection<
    BaseLanguageModelCallOptions,
    GoogleVertexAILLMInstance,
    TextPrediction,
    GoogleAuthOptions
  >;

  constructor(fields?: GoogleVertexAITextInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;

    // Change the defaults for code models
    if (this.model.startsWith("code-gecko")) {
      this.maxOutputTokens = 64;
    }
    if (this.model.startsWith("code-")) {
      this.temperature = 0.2;
    }

    this.temperature = fields?.temperature ?? this.temperature;
    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;

    this.connection = new GoogleVertexAILLMConnection(
      { ...fields, ...this },
      this.caller,
      new GoogleAuth({
        scopes: "https://www.googleapis.com/auth/cloud-platform",
        ...fields?.authOptions,
      })
    );
  }

  _llmType(): string {
    return "googlevertexai";
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"]
  ): Promise<LLMResult> {
    const generations: Generation[][] = await Promise.all(
      prompts.map((prompt) => this._generatePrompt(prompt, options))
    );
    return { generations };
  }

  async _generatePrompt(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<Generation[]> {
    const instance = this.formatInstance(prompt);
    const parameters: GoogleVertexAIModelParams = {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
    };
    const result = await this.connection.request(
      [instance],
      parameters,
      options
    );
    const prediction = this.extractPredictionFromResponse(result);
    return [
      {
        text: prediction.content,
        generationInfo: prediction,
      },
    ];
  }

  /**
   * Formats the input instance as a text instance for the Google Vertex AI
   * model.
   * @param prompt Prompt to be formatted as a text instance.
   * @returns A GoogleVertexAILLMInstance object representing the formatted text instance.
   */
  formatInstanceText(prompt: string): GoogleVertexAILLMInstance {
    return { content: prompt };
  }

  /**
   * Formats the input instance as a code instance for the Google Vertex AI
   * model.
   * @param prompt Prompt to be formatted as a code instance.
   * @returns A GoogleVertexAILLMInstance object representing the formatted code instance.
   */
  formatInstanceCode(prompt: string): GoogleVertexAILLMInstance {
    return { prefix: prompt };
  }

  /**
   * Formats the input instance for the Google Vertex AI model based on the
   * model type (text or code).
   * @param prompt Prompt to be formatted as an instance.
   * @returns A GoogleVertexAILLMInstance object representing the formatted instance.
   */
  formatInstance(prompt: string): GoogleVertexAILLMInstance {
    return this.model.startsWith("code-")
      ? this.formatInstanceCode(prompt)
      : this.formatInstanceText(prompt);
  }

  /**
   * Extracts the prediction from the API response.
   * @param result The API response from which to extract the prediction.
   * @returns A TextPrediction object representing the extracted prediction.
   */
  extractPredictionFromResponse(
    result: GoogleVertexAILLMResponse<TextPrediction>
  ): TextPrediction {
    return result?.data?.predictions[0];
  }
}
