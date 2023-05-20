import { BaseLLM } from "./base.js";
import { Generation, LLMResult } from "../schema/index.js";
import { GoogleVertexAiConnection } from "../util/googlevertexai-connection.js";
import {
  GoogleVertexAiBaseLLMInput,
  GoogleVertexAiBasePrediction,
  GoogleVertexAiLLMResponse,
  GoogleVertexAiModelParams,
} from "../types/googlevertexai-types.js";

export interface GoogleVertexAiTextInput extends GoogleVertexAiBaseLLMInput {}

interface GoogleVertexAiLLMTextInstance {
  content: string;
}

/**
 * Models the data returned from the API call
 */
interface TextPrediction extends GoogleVertexAiBasePrediction {
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
export class GoogleVertexAiTextLLM
  extends BaseLLM
  implements GoogleVertexAiTextInput
{
  model = "text-bison";

  temperature = 0.7;

  maxOutputTokens = 256;

  topP = 0.8;

  topK = 40;

  connection: GoogleVertexAiConnection<
    this["CallOptions"],
    GoogleVertexAiLLMTextInstance,
    TextPrediction
  >;

  constructor(fields?: GoogleVertexAiTextInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;

    this.connection = new GoogleVertexAiConnection(
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
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
    const parameters: GoogleVertexAiModelParams = {
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
    const prediction = this.convertResult(result);
    return [
      {
        text: prediction.content,
        generationInfo: prediction,
      },
    ];
  }

  formatInstance(prompt: string): GoogleVertexAiLLMTextInstance {
    return { content: prompt };
  }

  convertResult(
    result: GoogleVertexAiLLMResponse<TextPrediction>
  ): TextPrediction {
    return result?.data?.predictions[0];
  }
}
