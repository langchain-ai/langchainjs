import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { CohereClient } from "cohere-ai";

/**
 * Interface for the input parameters specific to the Cohere model.
 * @deprecated Use `CohereInput` from `@langchain/cohere` instead.
 */
export interface CohereInput extends BaseLLMParams {
  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxTokens?: number;

  /** Model to use */
  model?: string;

  apiKey?: string;
}

/**
 * Class representing a Cohere Large Language Model (LLM). It interacts
 * with the Cohere API to generate text completions.
 * @example
 * ```typescript
 * const model = new Cohere({
 *   temperature: 0.7,
 *   maxTokens: 20,
 *   maxRetries: 5,
 * });
 *
 * const res = await model.invoke(
 *   "Question: What would be a good company name for a company that makes colorful socks?\nAnswer:"
 * );
 * console.log({ res });
 * ```
 * @deprecated Use `Cohere` from `@langchain/cohere` instead.
 */
export class Cohere extends LLM implements CohereInput {
  static lc_name() {
    return "Cohere";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "COHERE_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "cohere_api_key",
    };
  }

  lc_serializable = true;

  temperature = 0;

  maxTokens = 250;

  model: string;

  apiKey: string;

  constructor(fields?: CohereInput) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("COHERE_API_KEY");

    if (!apiKey) {
      throw new Error(
        "Please set the COHERE_API_KEY environment variable or pass it to the constructor as the apiKey field."
      );
    }

    this.apiKey = apiKey;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "cohere";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const client = new CohereClient({ token: this.apiKey });

    // Hit the `generate` endpoint on the `large` model
    const generateResponse = await this.caller.callWithOptions(
      { signal: options.signal },
      client.generate.bind(client),
      {
        prompt,
        model: this.model,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        endSequences: options.stop,
      }
    );
    try {
      return generateResponse.generations[0].text;
    } catch {
      console.log(generateResponse);
      throw new Error("Could not parse response.");
    }
  }
}
