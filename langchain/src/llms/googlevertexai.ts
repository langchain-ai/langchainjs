import { BaseLLM } from "./base.js";
import { Generation, LLMResult } from "../schema/index.js";
import { GoogleVertexAIConnection } from "../util/googlevertexai-connection.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAILLMResponse,
  GoogleVertexAIModelParams,
} from "../types/googlevertexai-types.js";

export interface GoogleVertexAITextInput extends GoogleVertexAIBaseLLMInput {}

interface GoogleVertexAILLMTextInstance {
  content: string;
}

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

  private connection: GoogleVertexAIConnection<
    this["CallOptions"],
    GoogleVertexAILLMTextInstance,
    TextPrediction
  >;

  constructor(fields?: GoogleVertexAITextInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;

    this.connection = new GoogleVertexAIConnection(
      { ...fields, ...this },
      this.caller
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

  formatInstance(prompt: string): GoogleVertexAILLMTextInstance {
    return { content: prompt };
  }

  extractPredictionFromResponse(
    result: GoogleVertexAILLMResponse<TextPrediction>
  ): TextPrediction {
    return result?.data?.predictions[0];
  }
}
