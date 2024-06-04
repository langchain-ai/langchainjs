import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/streaming";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  SystemMessage,
  type BaseMessage,
  HumanMessage,
  ToolMessage,
  isAIMessage,
  MessageContent,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  type ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  StructuredOutputMethodOptions,
  type BaseLanguageModelCallOptions,
  BaseLanguageModelInput,
} from "@langchain/core/language_models/base";
import { StructuredToolInterface } from "@langchain/core/tools";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { isZodSchema } from "@langchain/core/utils/types";
import { ToolCall } from "@langchain/core/messages/tool";
import { z } from "zod";
import {
  AnthropicToolsOutputParser,
  extractToolCalls,
} from "./output_parsers.js";
import { AnthropicToolResponse } from "./types.js";

type AnthropicTool = {
  name: string;
  description: string;
  /**
   * JSON schema.
   */
  input_schema: Record<string, unknown>;
};

type AnthropicMessage = Anthropic.MessageParam;
type AnthropicMessageCreateParams = Anthropic.MessageCreateParamsNonStreaming;
type AnthropicStreamingMessageCreateParams =
  Anthropic.MessageCreateParamsStreaming;
type AnthropicMessageStreamEvent = Anthropic.MessageStreamEvent;
type AnthropicRequestOptions = Anthropic.RequestOptions;
type AnthropicToolChoice =
  | {
      type: "tool";
      name: string;
    }
  | "any"
  | "auto";
export interface ChatAnthropicCallOptions extends BaseLanguageModelCallOptions {
  tools?: (StructuredToolInterface | AnthropicTool)[];
  /**
   * Whether or not to specify what tool the model should use
   * @default "auto"
   */
  tool_choice?: AnthropicToolChoice;
}

type AnthropicMessageResponse = Anthropic.ContentBlock | AnthropicToolResponse;

function _formatImage(imageUrl: string) {
  const regex = /^data:(image\/.+);base64,(.+)$/;
  const match = imageUrl.match(regex);
  if (match === null) {
    throw new Error(
      [
        "Anthropic only supports base64-encoded images currently.",
        "Example: data:image/png;base64,/9j/4AAQSk...",
      ].join("\n\n")
    );
  }
  return {
    type: "base64",
    media_type: match[1] ?? "",
    data: match[2] ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function anthropicResponseToChatMessages(
  messages: AnthropicMessageResponse[],
  additionalKwargs: Record<string, unknown>
): ChatGeneration[] {
  const usage: Record<string, number> | null | undefined =
    additionalKwargs.usage as Record<string, number> | null | undefined;
  const usageMetadata =
    usage != null
      ? {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        }
      : undefined;
  if (messages.length === 1 && messages[0].type === "text") {
    return [
      {
        text: messages[0].text,
        message: new AIMessage({
          content: messages[0].text,
          additional_kwargs: additionalKwargs,
          usage_metadata: usageMetadata,
        }),
      },
    ];
  } else {
    const toolCalls = extractToolCalls(messages);
    const generations: ChatGeneration[] = [
      {
        text: "",
        message: new AIMessage({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: messages as any,
          additional_kwargs: additionalKwargs,
          tool_calls: toolCalls,
          usage_metadata: usageMetadata,
        }),
      },
    ];
    return generations;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAnthropicTool(tool: any): tool is AnthropicTool {
  return "input_schema" in tool;
}

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
  /** Anthropic API key */
  apiKey?: string;

  /** Anthropic API URL */
  anthropicApiUrl?: string;

  /** Model name to use */
  modelName: string;
  /** Model name to use */
  model: string;

  /** Overridable Anthropic ClientOptions */
  clientOptions: ClientOptions;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://console.anthropic.com/docs/api/reference |
   * `anthropic.messages`} that are not explicitly specified on this class.
   */
  invocationKwargs?: Kwargs;
}

/**
 * A type representing additional parameters that can be passed to the
 * Anthropic API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

function _mergeMessages(
  messages: BaseMessage[]
): (SystemMessage | HumanMessage | AIMessage)[] {
  // Merge runs of human/tool messages into single human messages with content blocks.
  const merged = [];
  for (const message of messages) {
    if (message._getType() === "tool") {
      if (typeof message.content === "string") {
        merged.push(
          new HumanMessage({
            content: [
              {
                type: "tool_result",
                content: message.content,
                tool_use_id: (message as ToolMessage).tool_call_id,
              },
            ],
          })
        );
      } else {
        merged.push(new HumanMessage({ content: message.content }));
      }
    } else {
      const previousMessage = merged[merged.length - 1];
      if (
        previousMessage?._getType() === "human" &&
        message._getType() === "human"
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let combinedContent: Record<string, any>[];
        if (typeof previousMessage.content === "string") {
          combinedContent = [{ type: "text", text: previousMessage.content }];
        } else {
          combinedContent = previousMessage.content;
        }
        if (typeof message.content === "string") {
          combinedContent.push({ type: "text", text: message.content });
        } else {
          combinedContent = combinedContent.concat(message.content);
        }
        previousMessage.content = combinedContent;
      } else {
        merged.push(message);
      }
    }
  }
  return merged;
}

export function _convertLangChainToolCallToAnthropic(
  toolCall: ToolCall
): AnthropicToolResponse {
  if (toolCall.id === undefined) {
    throw new Error(`Anthropic requires all tool calls to have an "id".`);
  }
  return {
    type: "tool_use",
    id: toolCall.id,
    name: toolCall.name,
    input: toolCall.args,
  };
}

function _formatContent(content: MessageContent) {
  if (typeof content === "string") {
    return content;
  } else {
    const contentBlocks = content.map((contentPart) => {
      if (contentPart.type === "image_url") {
        let source;
        if (typeof contentPart.image_url === "string") {
          source = _formatImage(contentPart.image_url);
        } else {
          source = _formatImage(contentPart.image_url.url);
        }
        return {
          type: "image" as const, // Explicitly setting the type as "image"
          source,
        };
      } else if (contentPart.type === "text") {
        // Assuming contentPart is of type MessageContentText here
        return {
          type: "text" as const, // Explicitly setting the type as "text"
          text: contentPart.text,
        };
      } else if (
        contentPart.type === "tool_use" ||
        contentPart.type === "tool_result"
      ) {
        // TODO: Fix when SDK types are fixed
        return {
          ...contentPart,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      } else {
        throw new Error("Unsupported message content format");
      }
    });
    return contentBlocks;
  }
}

/**
 * Formats messages as a prompt for the model.
 * @param messages The base messages to format as a prompt.
 * @returns The formatted prompt.
 */
function _formatMessagesForAnthropic(messages: BaseMessage[]): {
  system?: string;
  messages: AnthropicMessage[];
} {
  const mergedMessages = _mergeMessages(messages);
  let system: string | undefined;
  if (mergedMessages.length > 0 && mergedMessages[0]._getType() === "system") {
    if (typeof messages[0].content !== "string") {
      throw new Error("System message content must be a string.");
    }
    system = messages[0].content;
  }
  const conversationMessages =
    system !== undefined ? mergedMessages.slice(1) : mergedMessages;
  const formattedMessages = conversationMessages.map((message) => {
    let role;
    if (message._getType() === "human") {
      role = "user" as const;
    } else if (message._getType() === "ai") {
      role = "assistant" as const;
    } else if (message._getType() === "tool") {
      role = "user" as const;
    } else if (message._getType() === "system") {
      throw new Error(
        "System messages are only permitted as the first passed message."
      );
    } else {
      throw new Error(`Message type "${message._getType()}" is not supported.`);
    }
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      if (typeof message.content === "string") {
        if (message.content === "") {
          return {
            role,
            content: message.tool_calls.map(
              _convertLangChainToolCallToAnthropic
            ),
          };
        } else {
          return {
            role,
            content: [
              { type: "text", text: message.content },
              ...message.tool_calls.map(_convertLangChainToolCallToAnthropic),
            ],
          };
        }
      } else {
        const { content } = message;
        const hasMismatchedToolCalls = !message.tool_calls.every((toolCall) =>
          content.find(
            (contentPart) =>
              contentPart.type === "tool_use" && contentPart.id === toolCall.id
          )
        );
        if (hasMismatchedToolCalls) {
          console.warn(
            `The "tool_calls" field on a message is only respected if content is a string.`
          );
        }
        return {
          role,
          content: _formatContent(message.content),
        };
      }
    } else {
      return {
        role,
        content: _formatContent(message.content),
      };
    }
  });
  return {
    messages: formattedMessages,
    system,
  };
}

/**
 * Wrapper around Anthropic large language models.
 *
 * To use you should have the `@anthropic-ai/sdk` package installed, with the
 * `ANTHROPIC_API_KEY` environment variable set.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://console.anthropic.com/docs/api/reference |
 * `anthropic.messages`} can be passed through {@link invocationKwargs},
 * even if not explicitly available on this class.
 * @example
 * ```typescript
 * import { ChatAnthropic } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   temperature: 0.9,
 *   apiKey: 'YOUR-API-KEY',
 * });
 * const res = await model.invoke({ input: 'Hello!' });
 * console.log(res);
 * ```
 */
export class ChatAnthropicMessages<
    CallOptions extends ChatAnthropicCallOptions = ChatAnthropicCallOptions
  >
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements AnthropicInput
{
  static lc_name() {
    return "ChatAnthropic";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      anthropicApiKey: "ANTHROPIC_API_KEY",
      apiKey: "ANTHROPIC_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
    };
  }

  lc_serializable = true;

  anthropicApiKey?: string;

  apiKey?: string;

  apiUrl?: string;

  temperature = 1;

  topK = -1;

  topP = -1;

  maxTokens = 2048;

  modelName = "claude-2.1";

  model = "claude-2.1";

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
      fields?.apiKey ??
      fields?.anthropicApiKey ??
      getEnvironmentVariable("ANTHROPIC_API_KEY");
    if (!this.anthropicApiKey) {
      throw new Error("Anthropic API key not found");
    }
    /** Keep anthropicApiKey for backwards compatibility */
    this.apiKey = this.anthropicApiKey;

    // Support overriding the default API URL (i.e., https://api.anthropic.com)
    this.apiUrl = fields?.anthropicApiUrl;

    /** Keep modelName for backwards compatibility */
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;

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

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "openai",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  /**
   * Formats LangChain StructuredTools to AnthropicTools.
   *
   * @param {ChatAnthropicCallOptions["tools"]} tools The tools to format
   * @returns {AnthropicTool[] | undefined} The formatted tools, or undefined if none are passed.
   * @throws {Error} If a mix of AnthropicTools and StructuredTools are passed.
   */
  formatStructuredToolToAnthropic(
    tools: ChatAnthropicCallOptions["tools"]
  ): AnthropicTool[] | undefined {
    if (!tools || !tools.length) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((tools as any[]).every((tool) => isAnthropicTool(tool))) {
      // If the tool is already an anthropic tool, return it
      return tools as AnthropicTool[];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((tools as any[]).some((tool) => isAnthropicTool(tool))) {
      throw new Error(
        `Can not pass in a mix of AnthropicTools and StructuredTools`
      );
    }

    return (tools as StructuredToolInterface[]).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.schema),
    }));
  }

  override bindTools(
    tools: (AnthropicTool | StructuredToolInterface)[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    return this.bind({
      tools: this.formatStructuredToolToAnthropic(tools),
      ...kwargs,
    } as Partial<CallOptions>);
  }

  /**
   * Get the parameters used to invoke the model
   */
  override invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<
    AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams,
    "messages"
  > &
    Kwargs {
    let tool_choice:
      | {
          type: string;
          name?: string;
        }
      | undefined;
    if (options?.tool_choice) {
      if (options?.tool_choice === "any") {
        tool_choice = {
          type: "any",
        };
      } else if (options?.tool_choice === "auto") {
        tool_choice = {
          type: "auto",
        };
      } else {
        tool_choice = options?.tool_choice;
      }
    }

    return {
      model: this.model,
      temperature: this.temperature,
      top_k: this.topK,
      top_p: this.topP,
      stop_sequences: options?.stop ?? this.stopSequences,
      stream: this.streaming,
      max_tokens: this.maxTokens,
      tools: this.formatStructuredToolToAnthropic(options?.tools),
      tool_choice,
      ...this.invocationKwargs,
    };
  }

  /** @ignore */
  _identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const formattedMessages = _formatMessagesForAnthropic(messages);
    if (options.tools !== undefined && options.tools.length > 0) {
      const { generations } = await this._generateNonStreaming(
        messages,
        params,
        {
          signal: options.signal,
        }
      );
      const result = generations[0].message as AIMessage;
      const toolCallChunks = result.tool_calls?.map(
        (toolCall: ToolCall, index: number) => ({
          name: toolCall.name,
          args: JSON.stringify(toolCall.args),
          id: toolCall.id,
          index,
        })
      );
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: result.content,
          additional_kwargs: result.additional_kwargs,
          tool_call_chunks: toolCallChunks,
        }),
        text: generations[0].text,
      });
    } else {
      const stream = await this.createStreamWithRetry({
        ...params,
        ...formattedMessages,
        stream: true,
      });
      let usageData = { input_tokens: 0, output_tokens: 0 };
      for await (const data of stream) {
        if (options.signal?.aborted) {
          stream.controller.abort();
          throw new Error("AbortError: User aborted the request.");
        }
        if (data.type === "message_start") {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { content, usage, ...additionalKwargs } = data.message;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const filteredAdditionalKwargs: Record<string, any> = {};
          for (const [key, value] of Object.entries(additionalKwargs)) {
            if (value !== undefined && value !== null) {
              filteredAdditionalKwargs[key] = value;
            }
          }
          usageData = usage;
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
          if (data?.usage !== undefined) {
            usageData.output_tokens += data.usage.output_tokens;
          }
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
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          additional_kwargs: { usage: usageData },
        }),
        text: "",
      });
    }
  }

  /** @ignore */
  async _generateNonStreaming(
    messages: BaseMessage[],
    params: Omit<
      | Anthropic.Messages.MessageCreateParamsNonStreaming
      | Anthropic.Messages.MessageCreateParamsStreaming,
      "messages"
    > &
      Kwargs,
    requestOptions: AnthropicRequestOptions
  ) {
    const options =
      params.tools !== undefined
        ? {
            ...requestOptions,
            headers: {
              ...requestOptions.headers,
              "anthropic-beta": "tools-2024-04-04",
            },
          }
        : requestOptions;
    const response = await this.completionWithRetry(
      {
        ...params,
        stream: false,
        ..._formatMessagesForAnthropic(messages),
      },
      options
    );

    const { content, ...additionalKwargs } = response;

    const generations = anthropicResponseToChatMessages(
      content,
      additionalKwargs
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role: _role, type: _type, ...rest } = additionalKwargs;
    return { generations, llmOutput: rest };
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
      const stream = this._streamResponseChunks(messages, options, runManager);
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
      return this._generateNonStreaming(messages, params, {
        signal: options.signal,
      });
    }
  }

  /**
   * Creates a streaming request with retry.
   * @param request The parameters for creating a completion.
   * @returns A streaming request.
   */
  protected async createStreamWithRetry(
    request: AnthropicStreamingMessageCreateParams & Kwargs,
    options?: AnthropicRequestOptions
  ): Promise<Stream<AnthropicMessageStreamEvent>> {
    if (!this.streamingClient) {
      const options_ = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.streamingClient = new Anthropic({
        ...this.clientOptions,
        ...options_,
        apiKey: this.apiKey,
        // Prefer LangChain built-in retries
        maxRetries: 0,
      });
    }
    const makeCompletionRequest = async () =>
      this.streamingClient.messages.create(
        {
          ...request,
          ...this.invocationKwargs,
          stream: true,
        } as AnthropicStreamingMessageCreateParams,
        options
      );
    return this.caller.call(makeCompletionRequest);
  }

  /** @ignore */
  protected async completionWithRetry(
    request: AnthropicMessageCreateParams & Kwargs,
    options: AnthropicRequestOptions
  ): Promise<Anthropic.Message> {
    if (!this.apiKey) {
      throw new Error("Missing Anthropic API key.");
    }
    if (!this.batchClient) {
      const options = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.batchClient = new Anthropic({
        ...this.clientOptions,
        ...options,
        apiKey: this.apiKey,
        maxRetries: 0,
      });
    }
    const makeCompletionRequest = async () =>
      this.batchClient.messages.create(
        {
          ...request,
          ...this.invocationKwargs,
        } as AnthropicMessageCreateParams,
        options
      );
    return this.caller.callWithOptions(
      { signal: options.signal ?? undefined },
      makeCompletionRequest
    );
  }

  _llmType() {
    return "anthropic";
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: z.ZodType<RunOutput> | Record<string, any> = outputSchema;
    const name = config?.name;
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(`Anthropic only supports "functionCalling" as a method.`);
    }

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let tools: AnthropicTool[];
    if (isZodSchema(schema)) {
      const jsonSchema = zodToJsonSchema(schema);
      tools = [
        {
          name: functionName,
          description:
            jsonSchema.description ?? "A function available to call.",
          input_schema: jsonSchema,
        },
      ];
      outputParser = new AnthropicToolsOutputParser({
        returnSingle: true,
        keyName: functionName,
        zodSchema: schema,
      });
    } else {
      let anthropicTools: AnthropicTool;
      if (
        typeof schema.name === "string" &&
        typeof schema.description === "string" &&
        typeof schema.input_schema === "object" &&
        schema.input_schema != null
      ) {
        anthropicTools = schema as AnthropicTool;
        functionName = schema.name;
      } else {
        anthropicTools = {
          name: functionName,
          description: schema.description ?? "",
          input_schema: schema,
        };
      }
      tools = [anthropicTools];
      outputParser = new AnthropicToolsOutputParser<RunOutput>({
        returnSingle: true,
        keyName: functionName,
      });
    }
    const llm = this.bind({
      tools,
      tool_choice: "any",
    } as Partial<CallOptions>);

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatAnthropicStructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: BaseMessage; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "StructuredOutputRunnable",
    });
  }
}

export class ChatAnthropic extends ChatAnthropicMessages {}
