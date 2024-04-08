import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseLLMCallOptions,
  type BaseLLMParams,
  LLM,
} from "@langchain/core/language_models/llms";
import { GenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { convertEventStreamToIterableReadableDataStream } from "../utils/event_source_parse.js";

/**
 * The FriendliParams interface defines the input parameters for
 * the Friendli class.
 */
export interface FriendliParams extends BaseLLMParams {
  /**
   * Model name to use.
   */
  model?: string;
  /**
   * Friendli personal access token to run as.
   */
  friendliToken?: string;
  /**
   * Friendli team ID to run as.
   */
  friendliTeam?: string;
  /**
   * Number between -2.0 and 2.0. Positive values penalizes tokens that have been
   * sampled, taking into account their frequency in the preceding text. This
   * penalization diminishes the model's tendency to reproduce identical lines
   * verbatim.
   */
  frequencyPenalty?: number;
  /**
   * Number between -2.0 and 2.0. Positive values penalizes tokens that have been
   * sampled at least once in the existing text.
   * presence_penalty: Optional[float] = None
   * The maximum number of tokens to generate. The length of your input tokens plus
   * `max_tokens` should not exceed the model's maximum length (e.g., 2048 for OpenAI
   * GPT-3)
   */
  maxTokens?: number;
  /**
   * When one of the stop phrases appears in the generation result, the API will stop
   * generation. The phrase is included in the generated result. If you are using
   * beam search, all of the active beams should contain the stop phrase to terminate
   * generation. Before checking whether a stop phrase is included in the result, the
   * phrase is converted into tokens.
   */
  stop?: string[];
  /**
   * Sampling temperature. Smaller temperature makes the generation result closer to
   * greedy, argmax (i.e., `top_k = 1`) sampling. If it is `None`, then 1.0 is used.
   */
  temperature?: number;
  /**
   * Tokens comprising the top `top_p` probability mass are kept for sampling. Numbers
   * between 0.0 (exclusive) and 1.0 (inclusive) are allowed. If it is `None`, then 1.0
   * is used by default.
   */
  topP?: number;
}

/**
 * The Friendli class is used to interact with Friendli inference Endpoint models.
 * This requires your Friendli Token and Friendli Team which is autoloaded if not specified.
 */
export class Friendli extends LLM<BaseLLMCallOptions> {
  lc_serializable = true;

  static lc_name() {
    return "Friendli";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      friendliToken: "FRIENDLI_TOKEN",
      friendliTeam: "FRIENDLI_TEAM",
    };
  }

  model = "mixtral-8x7b-instruct-v0-1";

  friendliToken?: string;

  friendliTeam?: string;

  frequencyPenalty?: number;

  maxTokens?: number;

  stop?: string[];

  temperature?: number;

  topP?: number;

  constructor(fields: FriendliParams) {
    super(fields);

    this.model = fields?.model ?? this.model;
    this.friendliToken =
      fields?.friendliToken ?? getEnvironmentVariable("FRIENDLI_TOKEN");
    this.friendliTeam =
      fields?.friendliTeam ?? getEnvironmentVariable("FRIENDLI_TEAM");
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.stop = fields?.stop ?? this.stop;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;

    if (!this.friendliToken) {
      throw new Error("Missing Friendli Token");
    }

    if (!this.friendliTeam) {
      throw new Error("Missing Friendli Team");
    }
  }

  _llmType() {
    return "friendli";
  }

  /**
   * Calls the Friendli endpoint and retrieves the result.
   * @param {string} prompt The input prompt.
   * @returns {Promise<string>} A promise that resolves to the generated string.
   */
  /** @ignore */
  async _call(
    prompt: string,
    _options: this["ParsedCallOptions"]
  ): Promise<string> {
    interface FriendliResponse {
      choices: {
        index: number;
        seed: number;
        text: string;
        tokens: number[];
      }[];
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    }

    const response = (await this.caller.call(async () =>
      fetch("https://inference.friendli.ai/v1/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.friendliToken}`,
          ...(this.friendliTeam
            ? { "X-Friendli-Team": this.friendliTeam }
            : {}),
        },
        body: JSON.stringify({
          prompt,
          stream: false,
          model: this.model,
          max_tokens: this.maxTokens,
          frequency_penalty: this.frequencyPenalty,
          stop: this.stop,
          temperature: this.temperature,
          top_p: this.topP,
        }),
      }).then((res) => res.json())
    )) as FriendliResponse;

    return response.choices[0].text;
  }

  async *_streamResponseChunks(
    prompt: string,
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    interface FriendliResponse {
      event: string;
      index: number;
      text: string;
      token: number;
    }

    const response = await this.caller.call(async () =>
      fetch("https://inference.friendli.ai/v1/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.friendliToken}`,
          ...(this.friendliTeam
            ? { "X-Friendli-Team": this.friendliTeam }
            : {}),
        },
        body: JSON.stringify({
          prompt,
          stream: true,
          model: this.model,
          max_tokens: this.maxTokens,
          frequency_penalty: this.frequencyPenalty,
          stop: this.stop,
          temperature: this.temperature,
          top_p: this.topP,
        }),
      })
    );

    if (response.status !== 200 ?? !response.body) {
      const errorResponse = await response.json();
      throw new Error(JSON.stringify(errorResponse));
    }

    const stream = convertEventStreamToIterableReadableDataStream(
      response.body
    );

    for await (const chunk of stream) {
      const parsedChunk = JSON.parse(chunk) as FriendliResponse;

      if (parsedChunk.event !== "complete") {
        const generationChunk = new GenerationChunk({
          text: parsedChunk.text ?? "",
        });

        yield generationChunk;

        void runManager?.handleLLMNewToken(generationChunk.text ?? "");
      }
    }
  }
}
