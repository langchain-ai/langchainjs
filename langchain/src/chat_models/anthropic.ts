import { Anthropic, AI_PROMPT, HUMAN_PROMPT } from "@anthropic-ai/sdk";
import type { CompletionCreateParams } from "@anthropic-ai/sdk/resources/completions";

import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import {
  AIMessage,
  BaseMessage,
  ChatGeneration,
  ChatResult,
  MessageType,
} from "../schema/index.js";
import { getEnvironmentVariable } from "../util/env.js";
import { BaseChatModel, BaseChatModelParams } from "./base.js";

function getAnthropicPromptFromMessage(type: MessageType): string {
  switch (type) {
    case "ai":
      return AI_PROMPT;
    case "human":
      return HUMAN_PROMPT;
    case "system":
      return "";
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

const DEFAULT_STOP_SEQUENCES = [HUMAN_PROMPT];

/**
 * Input to AnthropicChat class.
 */
export interface AnthropicInput {
  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1. Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks.
   */
  temperature?: number;

  /** Only sample from the top K options for each subsequent
   * token. Used to remove "long tail" low probability
   * responses. Defaults to -1, which disables it.
   */
  topK?: number;

  /** Does nucleus sampling, in which we compute the
   * cumulative distribution over all the options for each
   * subsequent token in decreasing probability order and
   * cut it off once it reaches a particular probability
   * specified by top_p. Defaults to -1, which disables it.
   * Note that you should either alter temperature or top_p,
   * but not both.
   */
  topP?: number;

  /** A maximum number of tokens to generate before stopping. */
  maxTokensToSample: number;

  /** A list of strings upon which to stop generating.
   * You probably want `["\n\nHuman:"]`, as that's the cue for
   * the next turn in the dialog agent.
   */
  stopSequences?: string[];

  /** Whether to stream the results or not */
  streaming?: boolean;

  /** Anthropic API key */
  anthropicApiKey?: string;

  /** Anthropic API URL */
  anthropicApiUrl?: string;

  /** Model name to use */
  modelName: string;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://console.anthropic.com/docs/api/reference |
   * `anthropic.complete`} that are not explicitly specified on this class.
   */
  invocationKwargs?: Kwargs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

/**
 * Wrapper around Anthropic large language models.
 *
 * To use you should have the `@anthropic-ai/sdk` package installed, with the
 * `ANTHROPIC_API_KEY` environment variable set.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://console.anthropic.com/docs/api/reference |
 * `anthropic.complete`} can be passed through {@link invocationKwargs},
 * even if not explicitly available on this class.
 *
 */
export class ChatAnthropic extends BaseChatModel implements AnthropicInput {
  declare CallOptions: BaseLanguageModelCallOptions;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      anthropicApiKey: "ANTHROPIC_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
    };
  }

  lc_serializable = true;

  anthropicApiKey?: string;

  apiUrl?: string;

  temperature = 1;

  topK = -1;

  topP = -1;

  maxTokensToSample = 2048;

  modelName = "claude-v1";

  invocationKwargs?: Kwargs;

  stopSequences?: string[];

  streaming = false;

  // Used for non-streaming requests
  private batchClient: Anthropic;

  // Used for streaming requests
  private streamingClient: Anthropic;

  constructor(fields?: Partial<AnthropicInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.anthropicApiKey =
      fields?.anthropicApiKey ?? getEnvironmentVariable("ANTHROPIC_API_KEY");
    if (!this.anthropicApiKey) {
      throw new Error("Anthropic API key not found");
    }

    // Support overriding the default API URL (i.e., https://api.anthropic.com)
    this.apiUrl = fields?.anthropicApiUrl;

    this.modelName = fields?.modelName ?? this.modelName;
    this.invocationKwargs = fields?.invocationKwargs ?? {};

    this.temperature = fields?.temperature ?? this.temperature;
    this.topK = fields?.topK ?? this.topK;
    this.topP = fields?.topP ?? this.topP;
    this.maxTokensToSample =
      fields?.maxTokensToSample ?? this.maxTokensToSample;
    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.streaming = fields?.streaming ?? false;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<CompletionCreateParams, "prompt"> & Kwargs {
    return {
      model: this.modelName,
      temperature: this.temperature,
      top_k: this.topK,
      top_p: this.topP,
      stop_sequences:
        options?.stop?.concat(DEFAULT_STOP_SEQUENCES) ??
        this.stopSequences ??
        DEFAULT_STOP_SEQUENCES,
      max_tokens_to_sample: this.maxTokensToSample,
      stream: this.streaming,
      ...this.invocationKwargs,
    };
  }

  /** @ignore */
  _identifyingParams() {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
    };
  }

  private formatMessagesAsPrompt(messages: BaseMessage[]): string {
    return (
      messages
        .map((message) => {
          const messagePrompt = getAnthropicPromptFromMessage(
            message._getType()
          );
          return `${messagePrompt} ${message.content}`;
        })
        .join("") + AI_PROMPT
    );
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.stopSequences && options.stop) {
      throw new Error(
        `"stopSequence" parameter found in input and default params`
      );
    }

    const params = this.invocationParams(options);
    const response = await this.completionWithRetry(
      {
        ...params,
        prompt: this.formatMessagesAsPrompt(messages),
      },
      { signal: options.signal },
      runManager
    );

    const generations: ChatGeneration[] = response.completion
      .split(AI_PROMPT)
      .map((message) => ({
        text: message,
        message: new AIMessage(message),
      }));

    return {
      generations,
    };
  }

  /** @ignore */
  private async completionWithRetry(
    request: CompletionCreateParams & Kwargs,
    options: { signal?: AbortSignal },
    runManager?: CallbackManagerForLLMRun
  ): Promise<Anthropic.Completions.Completion> {
    if (!this.anthropicApiKey) {
      throw new Error("Missing Anthropic API key.");
    }
    let makeCompletionRequest: () => Promise<Anthropic.Completions.Completion>;

    let asyncCallerOptions = {};
    if (request.stream) {
      if (!this.streamingClient) {
        const options = this.apiUrl ? { apiUrl: this.apiUrl } : undefined;
        this.streamingClient = new Anthropic({
          ...options,
          apiKey: this.anthropicApiKey,
        });
      }
      makeCompletionRequest = async () => {
        const stream = await this.streamingClient.completions.create({
          ...request,
        });

        const completion: Anthropic.Completion = {
          completion: "",
          model: "",
          stop_reason: "",
        };

        for await (const data of stream) {
          completion.stop_reason = data.stop_reason;
          completion.model = data.model;

          if (options.signal?.aborted) {
            stream.controller.abort();
            throw new Error("AbortError: User aborted the request.");
          }

          if (data.stop_reason) {
            break;
          }
          const part = data.completion;
          if (part) {
            completion.completion += part;
            // eslint-disable-next-line no-void
            void runManager?.handleLLMNewToken(part ?? "");
          }
        }

        return completion;
      };
    } else {
      if (!this.batchClient) {
        const options = this.apiUrl ? { apiUrl: this.apiUrl } : undefined;
        this.batchClient = new Anthropic({
          ...options,
          apiKey: this.anthropicApiKey,
        });
      }
      asyncCallerOptions = { signal: options.signal };
      makeCompletionRequest = async () =>
        this.batchClient.completions.create({ ...request });
    }
    return this.caller.callWithOptions(
      asyncCallerOptions,
      makeCompletionRequest
    );
  }

  _llmType() {
    return "anthropic";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
