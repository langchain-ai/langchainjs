import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/streaming";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  type ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
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
import { z } from "zod";
import { AnthropicToolsOutputParser } from "./output_parsers.js";
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

interface ChatAnthropicCallOptions extends BaseLanguageModelCallOptions {
  tools?: StructuredToolInterface[] | AnthropicTool[];
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
  if (messages.length === 1 && messages[0].type === "text") {
    return [
      {
        text: messages[0].text,
        message: new AIMessage(messages[0].text, additionalKwargs),
      },
    ];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castMessage = messages as any;
    const generations: ChatGeneration[] = [
      {
        text: "",
        message: new AIMessage({
          content: castMessage,
          additional_kwargs: additionalKwargs,
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

  /** Anthropic API URL */
  anthropicApiUrl?: string;

  /** Model name to use */
  modelName: string;

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
 *   anthropicApiKey: 'YOUR-API-KEY',
 * });
 * const res = await model.invoke({ input: 'Hello!' });
 * console.log(res);
 * ```
 */
export class ChatAnthropicMessages<
    CallOptions extends ChatAnthropicCallOptions = ChatAnthropicCallOptions
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

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<
    AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams,
    "messages"
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

  invocationOptions(
    request: Omit<
      AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams,
      "messages"
    > &
      Kwargs,
    options: this["ParsedCallOptions"]
  ): AnthropicRequestOptions {
    const toolUseBetaHeader = {
      "anthropic-beta": "tools-2024-04-04",
    };
    const tools = this.formatStructuredToolToAnthropic(options?.tools);
    // If tools are present, populate the body with the message request params.
    // This is because Anthropic overwrites the message request params if a body
    // is passed.
    const body = tools
      ? {
          ...request,
          tools,
        }
      : undefined;
    const headers = tools ? toolUseBetaHeader : undefined;
    return {
      signal: options.signal,
      ...(body ? { body } : {}),
      ...(headers ? { headers } : {}),
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
    const requestOptions = this.invocationOptions(
      {
        ...params,
        stream: false,
        ...this.formatMessagesForAnthropic(messages),
      },
      options
    );
    if (options.tools !== undefined && options.tools.length > 0) {
      const requestOptions = this.invocationOptions(
        {
          ...params,
          stream: false,
          ...this.formatMessagesForAnthropic(messages),
        },
        options
      );
      const generations = await this._generateNonStreaming(
        messages,
        params,
        requestOptions
      );

      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: generations[0].message.content,
          additional_kwargs: generations[0].message.additional_kwargs,
        }),
        text: generations[0].text,
      });
    } else {
      const stream = await this.createStreamWithRetry(
        {
          ...params,
          ...this.formatMessagesForAnthropic(messages),
          stream: true,
        },
        requestOptions
      );
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

  /**
   * Formats messages as a prompt for the model.
   * @param messages The base messages to format as a prompt.
   * @returns The formatted prompt.
   */
  protected formatMessagesForAnthropic(messages: BaseMessage[]): {
    system?: string;
    messages: AnthropicMessage[];
  } {
    let system: string | undefined;
    if (messages.length > 0 && messages[0]._getType() === "system") {
      if (typeof messages[0].content !== "string") {
        throw new Error("System message content must be a string.");
      }
      system = messages[0].content;
    }
    const conversationMessages =
      system !== undefined ? messages.slice(1) : messages;
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
        throw new Error(
          `Message type "${message._getType()}" is not supported.`
        );
      }
      if (typeof message.content === "string") {
        return {
          role,
          content: message.content,
        };
      } else if ("type" in message.content) {
        const contentBlocks = message.content.map((contentPart) => {
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
          } else {
            throw new Error("Unsupported message content format");
          }
        });
        return {
          role,
          content: contentBlocks,
        };
      } else {
        throw new Error("Unsupported message content format");
      }
    });
    return {
      messages: formattedMessages,
      system,
    };
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
    const response = await this.completionWithRetry(
      {
        ...params,
        stream: false,
        ...this.formatMessagesForAnthropic(messages),
      },
      requestOptions
    );

    const { content, ...additionalKwargs } = response;

    const generations = anthropicResponseToChatMessages(
      content,
      additionalKwargs
    );
    return generations;
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
      const requestOptions = this.invocationOptions(
        {
          ...params,
          stream: false,
          ...this.formatMessagesForAnthropic(messages),
        },
        options
      );
      const generations = await this._generateNonStreaming(
        messages,
        params,
        requestOptions
      );
      return {
        generations,
      };
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
        apiKey: this.anthropicApiKey,
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
