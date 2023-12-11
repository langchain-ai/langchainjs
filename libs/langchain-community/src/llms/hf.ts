import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface defining the parameters for configuring the Hugging Face
 * model for text generation.
 */
export interface HFInput {
  /** Model to use */
  model: string;

  /** Custom inference endpoint URL to use */
  endpointUrl?: string;

  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens?: number;

  /** Total probability mass of tokens to consider at each step */
  topP?: number;

  /** Integer to define the top tokens considered within the sample operation to create new text. */
  topK?: number;

  /** Penalizes repeated tokens according to frequency */
  frequencyPenalty?: number;

  /** API key to use. */
  apiKey?: string;

  /**
   * Credentials to use for the request. If this is a string, it will be passed straight on. If it's a boolean, true will be "include" and false will not send credentials at all.
   */
  includeCredentials?: string | boolean;
}

/**
 * Class implementing the Large Language Model (LLM) interface using the
 * Hugging Face Inference API for text generation.
 * @example
 * ```typescript
 * const model = new HuggingFaceInference({
 *   model: "gpt2",
 *   temperature: 0.7,
 *   maxTokens: 50,
 * });
 *
 * const res = await model.call(
 *   "Question: What would be a good company name for a company that makes colorful socks?\nAnswer:"
 * );
 * console.log({ res });
 * ```
 */
export class HuggingFaceInference extends LLM implements HFInput {
  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "HUGGINGFACEHUB_API_KEY",
    };
  }

  model = "gpt2";

  temperature: number | undefined = undefined;

  maxTokens: number | undefined = undefined;

  topP: number | undefined = undefined;

  topK: number | undefined = undefined;

  frequencyPenalty: number | undefined = undefined;

  apiKey: string | undefined = undefined;

  endpointUrl: string | undefined = undefined;

  includeCredentials: string | boolean | undefined = undefined;

  constructor(fields?: Partial<HFInput> & BaseLLMParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable("HUGGINGFACEHUB_API_KEY");
    this.endpointUrl = fields?.endpointUrl;
    this.includeCredentials = fields?.includeCredentials;

    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for HuggingFace Hub in the environment variable HUGGINGFACEHUB_API_KEY or in the apiKey field of the HuggingFaceInference constructor."
      );
    }
  }

  _llmType() {
    return "hf";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const { HfInference } = await HuggingFaceInference.imports();
    const hf = this.endpointUrl
      ? new HfInference(this.apiKey, {
          includeCredentials: this.includeCredentials,
        }).endpoint(this.endpointUrl)
      : new HfInference(this.apiKey, {
          includeCredentials: this.includeCredentials,
        });

    const res = await this.caller.callWithOptions(
      { signal: options.signal },
      hf.textGeneration.bind(hf),
      {
        model: this.model,
        parameters: {
          // make it behave similar to openai, returning only the generated text
          return_full_text: false,
          temperature: this.temperature,
          max_new_tokens: this.maxTokens,
          top_p: this.topP,
          top_k: this.topK,
          repetition_penalty: this.frequencyPenalty,
        },
        inputs: prompt,
      }
    );
    return res.generated_text;
  }

  /** @ignore */
  static async imports(): Promise<{
    HfInference: typeof import("@huggingface/inference").HfInference;
  }> {
    try {
      const { HfInference } = await import("@huggingface/inference");
      return { HfInference };
    } catch (e) {
      throw new Error(
        "Please install huggingface as a dependency with, e.g. `yarn add @huggingface/inference`"
      );
    }
  }
}
