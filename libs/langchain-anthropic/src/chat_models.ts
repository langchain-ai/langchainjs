import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/streaming";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

type AnthropicMessage = Anthropic.Beta.MessageParam;
type AnthropicMessageCreateParams = Omit<
  Anthropic.Beta.MessageCreateParamsNonStreaming,
  "anthropic-beta"
>;
type AnthropicStreamingMessageCreateParams = Omit<
  Anthropic.Beta.MessageCreateParamsStreaming,
  "anthropic-beta"
>;
type AnthropicMessageStreamEvent = Anthropic.Beta.MessageStreamEvent;

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
  maxTokens?: number;

  /**
   * A maximum number of tokens to generate before stopping.
   * @deprecated Use "maxTokens" instead.
   */
  maxTokensToSample?: number;

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
 * `anthropic.beta.messages`} can be passed through {@link invocationKwargs},
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
export class ChatAnthropicMessages<
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

  maxTokens = 2048;

  modelName = "claude-2.1";

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
    this.maxTokens =
      fields?.maxTokensToSample ?? fields?.maxTokens ?? this.maxTokens;
    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.streaming = fields?.streaming ?? false;
    this.clientOptions = fields?.clientOptions ?? {};
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<
    AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams,
    "messages" | "anthropic-beta"
  > &
    Kwargs {
    return {
      model: this.modelName,
      temperature: this.temperature,
      top_k: this.topK,
      top_p: this.topP,
      stop_sequences: options?.stop ?? this.stopSequences,
      stream: this.streaming,
      max_tokens: this.maxTokens,
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
      ...this.formatMessagesForAnthropic(messages),
      stream: true,
    });
    for await (const data of stream) {
      if (options.signal?.aborted) {
        stream.controller.abort();
        throw new Error("AbortError: User aborted the request.");
      }
      if (data.type === "message_start") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { content, ...additionalKwargs } = data.message;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filteredAdditionalKwargs: Record<string, any> = {};
        for (const [key, value] of Object.entries(additionalKwargs)) {
          if (value !== undefined && value !== null) {
            filteredAdditionalKwargs[key] = value;
          }
        }
        yield new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: "",
            additional_kwargs: filteredAdditionalKwargs,
          }),
          text: "",
        });
      } else if (data.type === "message_delta") {
        yield new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: "",
            additional_kwargs: { ...data.delta },
          }),
          text: "",
        });
      } else if (data.type === "content_block_delta") {
        const content = data.delta?.text;
        if (content !== undefined) {
          yield new ChatGenerationChunk({
            message: new AIMessageChunk({
              content,
              additional_kwargs: {},
            }),
            text: content,
          });
          await runManager?.handleLLMNewToken(content);
        }
      }
    }
  }

  /**
   * Formats messages as a prompt for the model.
   * @param messages The base messages to format as a prompt.
   * @returns The formatted prompt.
   */
  protected formatMessagesForAnthropic(messages: BaseMessage[]): {
    system?: string;
    messages: AnthropicMessage[];
  } {
    let system;
    if (messages.length > 0 && messages[0]._getType() === "system") {
      if (typeof messages[0].content !== "string") {
        throw new Error(
          "Currently only string content messages are supported."
        );
      }
      system = messages[0].content;
    }
    const conversationMessages =
      system !== undefined ? messages.slice(1) : messages;
    const formattedMessages = conversationMessages.map((message) => {
      let role;
      if (typeof message.content !== "string") {
        throw new Error(
          "Currently only string content messages are supported."
        );
      }
      if (message._getType() === "human") {
        role = "user" as const;
      } else if (message._getType() === "ai") {
        role = "assistant" as const;
      } else if (message._getType() === "system") {
        throw new Error(
          "System messages are only permitted as the first passed message."
        );
      } else {
        throw new Error(
          `Message type "${message._getType()}" is not supported.`
        );
      }
      return {
        role,
        content: message.content,
      };
    });
    return {
      messages: formattedMessages,
      system,
    };
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
    if (params.stream) {
      let finalChunk: ChatGenerationChunk | undefined;
      const stream = await this._streamResponseChunks(
        messages,
        options,
        runManager
      );
      for await (const chunk of stream) {
        if (finalChunk === undefined) {
          finalChunk = chunk;
        } else {
          finalChunk = finalChunk.concat(chunk);
        }
      }
      if (finalChunk === undefined) {
        throw new Error("No chunks returned from Anthropic API.");
      }
      return {
        generations: [
          {
            text: finalChunk.text,
            message: finalChunk.message,
          },
        ],
      };
    } else {
      const response = await this.completionWithRetry(
        {
          ...params,
          stream: false,
          ...this.formatMessagesForAnthropic(messages),
        },
        { signal: options.signal }
      );

      const { content, ...additionalKwargs } = response;

      if (!Array.isArray(content) || content.length !== 1) {
        console.log(content);
        throw new Error(
          "Received multiple content parts in Anthropic response. Only single part messages are currently supported."
        );
      }

      return {
        generations: [
          {
            text: content[0].text,
            message: new AIMessage({
              content: content[0].text,
              additional_kwargs: additionalKwargs,
            }),
          },
        ],
      };
    }
  }

  /**
   * Creates a streaming request with retry.
   * @param request The parameters for creating a completion.
   * @returns A streaming request.
   */
  protected async createStreamWithRetry(
    request: AnthropicStreamingMessageCreateParams & Kwargs
  ): Promise<Stream<AnthropicMessageStreamEvent>> {
    if (!this.streamingClient) {
      const options = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.streamingClient = new Anthropic({
        ...this.clientOptions,
        ...options,
        apiKey: this.anthropicApiKey,
        // Prefer LangChain built-in retries
        maxRetries: 0,
      });
    }
    const makeCompletionRequest = async () =>
      this.streamingClient.beta.messages.create(
        // TODO: Fix typing once underlying SDK is fixed to not require unnecessary "anthropic-beta" param
        {
          ...request,
          ...this.invocationKwargs,
          stream: true,
        } as AnthropicStreamingMessageCreateParams & {
          "anthropic-beta": string;
        }
      );
    return this.caller.call(makeCompletionRequest);
  }

  /** @ignore */
  protected async completionWithRetry(
    request: AnthropicMessageCreateParams & Kwargs,
    options: { signal?: AbortSignal }
  ): Promise<Anthropic.Beta.Message> {
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
      this.batchClient.beta.messages.create(
        // TODO: Fix typing once underlying SDK is fixed to not require unnecessary "anthropic-beta" param
        {
          ...request,
          ...this.invocationKwargs,
        } as AnthropicMessageCreateParams & { "anthropic-beta": string }
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

export class ChatAnthropic extends ChatAnthropicMessages {}
