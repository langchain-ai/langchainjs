import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Interface for the input parameters specific to the Aleph Alpha LLM.
 */
export interface AlephAlphaInput extends BaseLLMParams {
  model: string;
  maximum_tokens: number;
  minimum_tokens?: number;
  echo?: boolean;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  sequence_penalty?: number;
  sequence_penalty_min_length?: number;
  repetition_penalties_include_prompt?: boolean;
  repetition_penalties_include_completion?: boolean;
  use_multiplicative_presence_penalty?: boolean;
  use_multiplicative_frequency_penalty?: boolean;
  use_multiplicative_sequence_penalty?: boolean;
  penalty_bias?: string;
  penalty_exceptions?: string[];
  penalty_exceptions_include_stop_sequences?: boolean;
  best_of?: number;
  n?: number;
  logit_bias?: object;
  log_probs?: number;
  tokens?: boolean;
  raw_completion: boolean;
  disable_optimizations?: boolean;
  completion_bias_inclusion?: string[];
  completion_bias_inclusion_first_token_only: boolean;
  completion_bias_exclusion?: string[];
  completion_bias_exclusion_first_token_only: boolean;
  contextual_control_threshold?: number;
  control_log_additive: boolean;
  stop?: string[];
  aleph_alpha_api_key?: string;
  base_url: string;
}

/**
 * Specific implementation of a Large Language Model (LLM) designed to
 * interact with the Aleph Alpha API. It extends the base LLM class and
 * includes a variety of parameters for customizing the behavior of the
 * Aleph Alpha model.
 */
export class AlephAlpha extends LLM implements AlephAlphaInput {
  lc_serializable = true;

  model = "luminous-base";

  maximum_tokens = 64;

  minimum_tokens = 0;

  echo: boolean;

  temperature = 0.0;

  top_k: number;

  top_p = 0.0;

  presence_penalty?: number;

  frequency_penalty?: number;

  sequence_penalty?: number;

  sequence_penalty_min_length?: number;

  repetition_penalties_include_prompt?: boolean;

  repetition_penalties_include_completion?: boolean;

  use_multiplicative_presence_penalty?: boolean;

  use_multiplicative_frequency_penalty?: boolean;

  use_multiplicative_sequence_penalty?: boolean;

  penalty_bias?: string;

  penalty_exceptions?: string[];

  penalty_exceptions_include_stop_sequences?: boolean;

  best_of?: number;

  n?: number;

  logit_bias?: object;

  log_probs?: number;

  tokens?: boolean;

  raw_completion: boolean;

  disable_optimizations?: boolean;

  completion_bias_inclusion?: string[];

  completion_bias_inclusion_first_token_only: boolean;

  completion_bias_exclusion?: string[];

  completion_bias_exclusion_first_token_only: boolean;

  contextual_control_threshold?: number;

  control_log_additive: boolean;

  aleph_alpha_api_key? = getEnvironmentVariable("ALEPH_ALPHA_API_KEY");

  stop?: string[];

  base_url = "https://api.aleph-alpha.com/complete";

  constructor(fields: Partial<AlephAlpha>) {
    super(fields ?? {});
    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maximum_tokens = fields?.maximum_tokens ?? this.maximum_tokens;
    this.minimum_tokens = fields?.minimum_tokens ?? this.minimum_tokens;
    this.top_k = fields?.top_k ?? this.top_k;
    this.top_p = fields?.top_p ?? this.top_p;
    this.presence_penalty = fields?.presence_penalty ?? this.presence_penalty;
    this.frequency_penalty =
      fields?.frequency_penalty ?? this.frequency_penalty;
    this.sequence_penalty = fields?.sequence_penalty ?? this.sequence_penalty;
    this.sequence_penalty_min_length =
      fields?.sequence_penalty_min_length ?? this.sequence_penalty_min_length;
    this.repetition_penalties_include_prompt =
      fields?.repetition_penalties_include_prompt ??
      this.repetition_penalties_include_prompt;
    this.repetition_penalties_include_completion =
      fields?.repetition_penalties_include_completion ??
      this.repetition_penalties_include_completion;
    this.use_multiplicative_presence_penalty =
      fields?.use_multiplicative_presence_penalty ??
      this.use_multiplicative_presence_penalty;
    this.use_multiplicative_frequency_penalty =
      fields?.use_multiplicative_frequency_penalty ??
      this.use_multiplicative_frequency_penalty;
    this.use_multiplicative_sequence_penalty =
      fields?.use_multiplicative_sequence_penalty ??
      this.use_multiplicative_sequence_penalty;
    this.penalty_bias = fields?.penalty_bias ?? this.penalty_bias;
    this.penalty_exceptions =
      fields?.penalty_exceptions ?? this.penalty_exceptions;
    this.penalty_exceptions_include_stop_sequences =
      fields?.penalty_exceptions_include_stop_sequences ??
      this.penalty_exceptions_include_stop_sequences;
    this.best_of = fields?.best_of ?? this.best_of;
    this.n = fields?.n ?? this.n;
    this.logit_bias = fields?.logit_bias ?? this.logit_bias;
    this.log_probs = fields?.log_probs ?? this.log_probs;
    this.tokens = fields?.tokens ?? this.tokens;
    this.raw_completion = fields?.raw_completion ?? this.raw_completion;
    this.disable_optimizations =
      fields?.disable_optimizations ?? this.disable_optimizations;
    this.completion_bias_inclusion =
      fields?.completion_bias_inclusion ?? this.completion_bias_inclusion;
    this.completion_bias_inclusion_first_token_only =
      fields?.completion_bias_inclusion_first_token_only ??
      this.completion_bias_inclusion_first_token_only;
    this.completion_bias_exclusion =
      fields?.completion_bias_exclusion ?? this.completion_bias_exclusion;
    this.completion_bias_exclusion_first_token_only =
      fields?.completion_bias_exclusion_first_token_only ??
      this.completion_bias_exclusion_first_token_only;
    this.contextual_control_threshold =
      fields?.contextual_control_threshold ?? this.contextual_control_threshold;
    this.control_log_additive =
      fields?.control_log_additive ?? this.control_log_additive;
    this.aleph_alpha_api_key =
      fields?.aleph_alpha_api_key ?? this.aleph_alpha_api_key;
    this.stop = fields?.stop ?? this.stop;
  }

  /**
   * Validates the environment by ensuring the necessary Aleph Alpha API key
   * is available. Throws an error if the API key is missing.
   */
  validateEnvironment() {
    if (!this.aleph_alpha_api_key) {
      throw new Error(
        "Aleph Alpha API Key is missing in environment variables."
      );
    }
  }

  /** Get the default parameters for calling Aleph Alpha API. */
  get defaultParams() {
    return {
      model: this.model,
      temperature: this.temperature,
      maximum_tokens: this.maximum_tokens,
      minimum_tokens: this.minimum_tokens,
      top_k: this.top_k,
      top_p: this.top_p,
      presence_penalty: this.presence_penalty,
      frequency_penalty: this.frequency_penalty,
      sequence_penalty: this.sequence_penalty,
      sequence_penalty_min_length: this.sequence_penalty_min_length,
      repetition_penalties_include_prompt:
        this.repetition_penalties_include_prompt,
      repetition_penalties_include_completion:
        this.repetition_penalties_include_completion,
      use_multiplicative_presence_penalty:
        this.use_multiplicative_presence_penalty,
      use_multiplicative_frequency_penalty:
        this.use_multiplicative_frequency_penalty,
      use_multiplicative_sequence_penalty:
        this.use_multiplicative_sequence_penalty,
      penalty_bias: this.penalty_bias,
      penalty_exceptions: this.penalty_exceptions,
      penalty_exceptions_include_stop_sequences:
        this.penalty_exceptions_include_stop_sequences,
      best_of: this.best_of,
      n: this.n,
      logit_bias: this.logit_bias,
      log_probs: this.log_probs,
      tokens: this.tokens,
      raw_completion: this.raw_completion,
      disable_optimizations: this.disable_optimizations,
      completion_bias_inclusion: this.completion_bias_inclusion,
      completion_bias_inclusion_first_token_only:
        this.completion_bias_inclusion_first_token_only,
      completion_bias_exclusion: this.completion_bias_exclusion,
      completion_bias_exclusion_first_token_only:
        this.completion_bias_exclusion_first_token_only,
      contextual_control_threshold: this.contextual_control_threshold,
      control_log_additive: this.control_log_additive,
    };
  }

  /** Get the identifying parameters for this LLM. */
  get identifyingParams() {
    return { ...this.defaultParams };
  }

  /** Get the type of LLM. */
  _llmType(): string {
    return "aleph_alpha";
  }

  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    let stop = options?.stop;
    this.validateEnvironment();
    if (this.stop && stop && this.stop.length > 0 && stop.length > 0) {
      throw new Error("`stop` found in both the input and default params.");
    }
    stop = this.stop ?? stop ?? [];
    const headers = {
      Authorization: `Bearer ${this.aleph_alpha_api_key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const data = { prompt, stop_sequences: stop, ...this.defaultParams };
    const responseData = await this.caller.call(async () => {
      const response = await fetch(this.base_url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: options.signal,
      });
      if (!response.ok) {
        // consume the response body to release the connection
        // https://undici.nodejs.org/#/?id=garbage-collection
        const text = await response.text();
        const error = new Error(
          `Aleph Alpha call failed with status ${response.status} and body ${text}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).response = response;
        throw error;
      }
      return response.json();
    });

    if (
      !responseData.completions ||
      responseData.completions.length === 0 ||
      !responseData.completions[0].completion
    ) {
      throw new Error("No completions found in response");
    }

    return responseData.completions[0].completion ?? "";
  }
}
