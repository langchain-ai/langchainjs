import {
  Anthropic,
  AI_PROMPT,
  HUMAN_PROMPT,
  ClientOptions,
} from "@anthropic-ai/sdk";
import type { CompletionCreateParams } from "@anthropic-ai/sdk/resources/completions";
import type { Stream } from "@anthropic-ai/sdk/streaming";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import {
  type ChatGeneration,
  ChatGenerationChunk,
  type ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

export { AI_PROMPT, HUMAN_PROMPT };

/**
 * Extracts the custom role of a generic chat message.
 * @param message The chat message from which to extract the custom role.
 * @returns The custom role of the chat message.
 */
function extractGenericMessageCustomRole(message: ChatMessage) {
  if (
    message.role !== AI_PROMPT &&
    message.role !== HUMAN_PROMPT &&
    message.role !== ""
  ) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role;
}

/**
 * Gets the Anthropic prompt from a base message.
 * @param message The base message from which to get the Anthropic prompt.
 * @returns The Anthropic prompt from the base message.
 */
function getAnthropicPromptFromMessage(message: BaseMessage): string {
  const type = message._getType();
  switch (type) {
    case "ai":
      return AI_PROMPT;
    case "human":
      return HUMAN_PROMPT;
    case "system":
      return "";
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export const DEFAULT_STOP_SEQUENCES = [HUMAN_PROMPT];

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

  /** Overridable Anthropic ClientOptions */
  clientOptions: ClientOptions;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://console.anthropic.com/docs/api/reference |
   * `anthropic.complete`} that are not explicitly specified on this class.
   */
  invocationKwargs?: Kwargs;
}

/**
 * A type representing additional parameters that can be passed to the
 * Anthropic API.
 */
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
 * @example
 * ```typescript
 * const model = new ChatAnthropic({
 *   temperature: 0.9,
 *   anthropicApiKey: 'YOUR-API-KEY',
 * });
 * const res = await model.invoke({ input: 'Hello!' });
 * console.log(res);
 * ```
 */
export class ChatAnthropic<
    CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
  >
  extends BaseChatModel<CallOptions>
  implements AnthropicInput
{
  static lc_name() {
    return "ChatAnthropic";
  }

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

  modelName = "claude-2";

  invocationKwargs?: Kwargs;

  stopSequences?: string[];

  streaming = false;

  clientOptions: ClientOptions;

  // Used for non-streaming requests
  protected batchClient: Anthropic;

  // Used for streaming requests
  protected streamingClient: Anthropic;

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
    this.clientOptions = fields?.clientOptions ?? {};
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

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const stream = await this.createStreamWithRetry({
      ...params,
      prompt: this.formatMessagesAsPrompt(messages),
    });
    let modelSent = false;
    let stopReasonSent = false;
    for await (const data of stream) {
      if (options.signal?.aborted) {
        stream.controller.abort();
        throw new Error("AbortError: User aborted the request.");
      }
      const additional_kwargs: Record<string, unknown> = {};
      if (data.model && !modelSent) {
        additional_kwargs.model = data.model;
        modelSent = true;
      } else if (data.stop_reason && !stopReasonSent) {
        additional_kwargs.stop_reason = data.stop_reason;
        stopReasonSent = true;
      }
      const delta = data.completion ?? "";
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: delta,
          additional_kwargs,
        }),
        text: delta,
      });
      await runManager?.handleLLMNewToken(delta);
      if (data.stop_reason) {
        break;
      }
    }
  }

  /**
   * Formats messages as a prompt for the model.
   * @param messages The base messages to format as a prompt.
   * @returns The formatted prompt.
   */
  protected formatMessagesAsPrompt(messages: BaseMessage[]): string {
    return (
      messages
        .map((message) => {
          const messagePrompt = getAnthropicPromptFromMessage(message);
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
    let response;
    if (params.stream) {
      response = {
        completion: "",
        model: "",
        stop_reason: "",
      };
      const stream = await this._streamResponseChunks(
        messages,
        options,
        runManager
      );
      for await (const chunk of stream) {
        response.completion += chunk.message.content;
        response.model =
          (chunk.message.additional_kwargs.model as string) ?? response.model;
        response.stop_reason =
          (chunk.message.additional_kwargs.stop_reason as string) ??
          response.stop_reason;
      }
    } else {
      response = await this.completionWithRetry(
        {
          ...params,
          prompt: this.formatMessagesAsPrompt(messages),
        },
        { signal: options.signal }
      );
    }

    const generations: ChatGeneration[] = (response.completion ?? "")
      .split(AI_PROMPT)
      .map((message) => ({
        text: message,
        message: new AIMessage(message),
      }));

    return {
      generations,
    };
  }

  /**
   * Creates a streaming request with retry.
   * @param request The parameters for creating a completion.
   * @returns A streaming request.
   */
  protected async createStreamWithRetry(
    request: CompletionCreateParams & Kwargs
  ): Promise<Stream<Anthropic.Completions.Completion>> {
    if (!this.streamingClient) {
      const options = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.streamingClient = new Anthropic({
        ...this.clientOptions,
        ...options,
        apiKey: this.anthropicApiKey,
        maxRetries: 0,
      });
    }
    const makeCompletionRequest = async () =>
      this.streamingClient.completions.create(
        { ...request, stream: true },
        { headers: request.headers }
      );
    return this.caller.call(makeCompletionRequest);
  }

  /** @ignore */
  protected async completionWithRetry(
    request: CompletionCreateParams & Kwargs,
    options: { signal?: AbortSignal }
  ): Promise<Anthropic.Completions.Completion> {
    if (!this.anthropicApiKey) {
      throw new Error("Missing Anthropic API key.");
    }
    if (!this.batchClient) {
      const options = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.batchClient = new Anthropic({
        ...this.clientOptions,
        ...options,
        apiKey: this.anthropicApiKey,
        maxRetries: 0,
      });
    }
    const makeCompletionRequest = async () =>
      this.batchClient.completions.create(
        { ...request, stream: false },
        { headers: request.headers }
      );
    return this.caller.callWithOptions(
      { signal: options.signal },
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
