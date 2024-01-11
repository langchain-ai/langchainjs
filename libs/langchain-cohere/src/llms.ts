import { CohereClient, Cohere as CohereTypes } from "cohere-ai";

import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

/**
 * Interface for the input parameters specific to the Cohere model.
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

interface CohereCallOptions
  extends BaseLanguageModelCallOptions,
    Partial<Omit<CohereTypes.GenerateRequest, "message">> {}

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
 * const res = await model.call(
 *   "Question: What would be a good company name for a company that makes colorful socks?\nAnswer:"
 * );
 * console.log({ res });
 * ```
 */
export class Cohere extends LLM<CohereCallOptions> implements CohereInput {
  static lc_name() {
    return "Cohere";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "COHERE_API_KEY",
      api_key: "COHERE_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "cohere_api_key",
      api_key: "cohere_api_key",
    };
  }

  lc_serializable = true;

  temperature = 0;

  maxTokens = 250;

  model: string;

  apiKey: string;

  client: CohereClient;

  constructor(fields?: CohereInput) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("COHERE_API_KEY");

    if (!apiKey) {
      throw new Error(
        "Please set the COHERE_API_KEY environment variable or pass it to the constructor as the apiKey field."
      );
    }

    this.client = new CohereClient({
      token: apiKey,
    });
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.model = fields?.model ?? this.model;
  }

  _llmType() {
    return "cohere";
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const params = {
      model: this.model,
      numGenerations: options.numGenerations,
      maxTokens: options.maxTokens ?? this.maxTokens,
      truncate: options.truncate,
      temperature: options.temperature ?? this.temperature,
      preset: options.preset,
      endSequences: options.endSequences,
      stopSequences: options.stop ?? options.stopSequences,
      k: options.k,
      p: options.p,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      returnLikelihoods: options.returnLikelihoods,
      logitBias: options.logitBias,
    };
    // Filter undefined entries
    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const generateResponse = await this.caller.callWithOptions(
      { signal: options.signal },
      async () => {
        let response;
        try {
          response = await this.client.generate({
            prompt,
            ...this.invocationParams(options),
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          e.status = e.status ?? e.statusCode;
          throw e;
        }
        return response;
      }
    );
    try {
      await runManager?.handleLLMNewToken(generateResponse.generations[0].text);
      return generateResponse.generations[0].text;
    } catch {
      console.log(generateResponse);
      throw new Error("Could not parse response.");
    }
  }
}
