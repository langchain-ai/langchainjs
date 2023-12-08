import { BaseLLM } from "@langchain/core/language_models/llms";
import {
  Generation,
  GenerationChunk,
  LLMResult,
} from "@langchain/core/outputs";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import {
  GoogleVertexAILLMConnection,
  GoogleVertexAIStream,
  GoogleVertexAILLMResponse,
} from "../../utils/googlevertexai-connection.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAILLMPredictions,
  GoogleVertexAIModelParams,
} from "../../types/googlevertexai-types.js";

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
 * Base class for Google Vertex AI LLMs.
 * Implemented subclasses must provide a GoogleVertexAILLMConnection
 * with an appropriate auth client.
 */
export class BaseGoogleVertexAI<AuthOptions>
  extends BaseLLM
  implements GoogleVertexAIBaseLLMInput<AuthOptions>
{
  lc_serializable = true;

  model = "text-bison";

  temperature = 0.7;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  protected connection: GoogleVertexAILLMConnection<
    BaseLanguageModelCallOptions,
    GoogleVertexAILLMInstance,
    TextPrediction,
    AuthOptions
  >;

  protected streamedConnection: GoogleVertexAILLMConnection<
    BaseLanguageModelCallOptions,
    GoogleVertexAILLMInstance,
    TextPrediction,
    AuthOptions
  >;

  get lc_aliases(): Record<string, string> {
    return {
      model: "model_name",
    };
  }

  constructor(fields?: GoogleVertexAIBaseLLMInput<AuthOptions>) {
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
  }

  _llmType(): string {
    return "vertexai";
  }

  async *_streamResponseChunks(
    _input: string,
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    // Make the call as a streaming request
    const instance = this.formatInstance(_input);
    const parameters = this.formatParameters();
    const result = await this.streamedConnection.request(
      [instance],
      parameters,
      _options
    );

    // Get the streaming parser of the response
    const stream = result.data as GoogleVertexAIStream;

    // Loop until the end of the stream
    // During the loop, yield each time we get a chunk from the streaming parser
    // that is either available or added to the queue
    while (!stream.streamDone) {
      const output = await stream.nextChunk();
      const chunk =
        output !== null
          ? new GenerationChunk(
              this.extractGenerationFromPrediction(output.outputs[0])
            )
          : new GenerationChunk({
              text: "",
              generationInfo: { finishReason: "stop" },
            });
      yield chunk;
    }
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
    const parameters = this.formatParameters();
    const result = await this.connection.request(
      [instance],
      parameters,
      options
    );
    const prediction = this.extractPredictionFromResponse(result);
    return [this.extractGenerationFromPrediction(prediction)];
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

  formatParameters(): GoogleVertexAIModelParams {
    return {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
    };
  }

  /**
   * Extracts the prediction from the API response.
   * @param result The API response from which to extract the prediction.
   * @returns A TextPrediction object representing the extracted prediction.
   */
  extractPredictionFromResponse(
    result: GoogleVertexAILLMResponse<TextPrediction>
  ): TextPrediction {
    return (result?.data as GoogleVertexAILLMPredictions<TextPrediction>)
      ?.predictions[0];
  }

  extractGenerationFromPrediction(prediction: TextPrediction): Generation {
    return {
      text: prediction.content,
      generationInfo: prediction,
    };
  }
}
