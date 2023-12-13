import { Writer as WriterClient } from "@writerai/writer-sdk";

import { type BaseLLMParams, LLM } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for the input parameters specific to the Writer model.
 */
export interface WriterInput extends BaseLLMParams {
  /** Writer API key */
  apiKey?: string;

  /** Writer organization ID */
  orgId?: string | number;

  /** Model to use */
  model?: string;

  /** Sampling temperature to use */
  temperature?: number;

  /** Minimum number of tokens to generate. */
  minTokens?: number;

  /** Maximum number of tokens to generate in the completion. */
  maxTokens?: number;

  /** Generates this many completions server-side and returns the "best"." */
  bestOf?: number;

  /** Penalizes repeated tokens according to frequency. */
  frequencyPenalty?: number;

  /** Whether to return log probabilities. */
  logprobs?: number;

  /** Number of completions to generate. */
  n?: number;

  /** Penalizes repeated tokens regardless of frequency. */
  presencePenalty?: number;

  /** Total probability mass of tokens to consider at each step. */
  topP?: number;
}

/**
 * Class representing a Writer Large Language Model (LLM). It interacts
 * with the Writer API to generate text completions.
 */
export class Writer extends LLM implements WriterInput {
  static lc_name() {
    return "Writer";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "WRITER_API_KEY",
      orgId: "WRITER_ORG_ID",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "writer_api_key",
      orgId: "writer_org_id",
    };
  }

  lc_serializable = true;

  apiKey: string;

  orgId: number;

  model = "palmyra-instruct";

  temperature?: number;

  minTokens?: number;

  maxTokens?: number;

  bestOf?: number;

  frequencyPenalty?: number;

  logprobs?: number;

  n?: number;

  presencePenalty?: number;

  topP?: number;

  constructor(fields?: WriterInput) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("WRITER_API_KEY");
    const orgId = fields?.orgId ?? getEnvironmentVariable("WRITER_ORG_ID");

    if (!apiKey) {
      throw new Error(
        "Please set the WRITER_API_KEY environment variable or pass it to the constructor as the apiKey field."
      );
    }

    if (!orgId) {
      throw new Error(
        "Please set the WRITER_ORG_ID environment variable or pass it to the constructor as the orgId field."
      );
    }

    this.apiKey = apiKey;
    this.orgId = typeof orgId === "string" ? parseInt(orgId, 10) : orgId;
    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.minTokens = fields?.minTokens ?? this.minTokens;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.bestOf = fields?.bestOf ?? this.bestOf;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.logprobs = fields?.logprobs ?? this.logprobs;
    this.n = fields?.n ?? this.n;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.topP = fields?.topP ?? this.topP;
  }

  _llmType() {
    return "writer";
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const sdk = new WriterClient({
      security: {
        apiKey: this.apiKey,
      },
      organizationId: this.orgId,
    });

    return this.caller.callWithOptions({ signal: options.signal }, async () => {
      try {
        const res = await sdk.completions.create({
          completionRequest: {
            prompt,
            stop: options.stop,
            temperature: this.temperature,
            minTokens: this.minTokens,
            maxTokens: this.maxTokens,
            bestOf: this.bestOf,
            n: this.n,
            frequencyPenalty: this.frequencyPenalty,
            logprobs: this.logprobs,
            presencePenalty: this.presencePenalty,
            topP: this.topP,
          },
          modelId: this.model,
        });
        return (
          res.completionResponse?.choices?.[0].text ?? "No completion found."
        );
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e as any).response = (e as any).rawResponse;
        throw e;
      }
    });
  }
}
