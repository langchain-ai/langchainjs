import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/streaming";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessageChunk,
  type BaseMessage,
  UsageMetadata,
} from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  type StructuredOutputMethodOptions,
  type BaseLanguageModelInput,
  type ToolDefinition,
  isOpenAITool,
} from "@langchain/core/language_models/base";
import { StructuredToolInterface } from "@langchain/core/tools";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
  RunnableToolLike,
} from "@langchain/core/runnables";
import { isZodSchema } from "@langchain/core/utils/types";
import { z } from "zod";
import type {
  MessageCreateParams,
  Tool as AnthropicTool,
} from "@anthropic-ai/sdk/resources/index.mjs";

import { AnthropicToolsOutputParser } from "./output_parsers.js";
import {
  AnthropicToolChoice,
  AnthropicToolTypes,
  extractToolCallChunk,
  handleToolChoice,
} from "./utils/tools.js";
import { _formatMessagesForAnthropic } from "./utils/message_inputs.js";
import {
  _makeMessageChunkFromAnthropicEvent,
  anthropicResponseToChatMessages,
} from "./utils/message_outputs.js";
import {
  AnthropicMessageCreateParams,
  AnthropicMessageStreamEvent,
  AnthropicRequestOptions,
  AnthropicStreamingMessageCreateParams,
} from "./types.js";

export interface ChatAnthropicCallOptions
  extends BaseChatModelCallOptions,
    Pick<AnthropicInput, "streamUsage"> {
  tools?: AnthropicToolTypes[];
  /**
   * Whether or not to specify what tool the model should use
   * @default "auto"
   */
  tool_choice?: AnthropicToolChoice;
}

function _toolsInParams(params: AnthropicMessageCreateParams): boolean {
  return !!(params.tools && params.tools.length > 0);
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

  /**
   * Whether or not to include token usage data in streamed chunks.
   * @default true
   */
  streamUsage?: boolean;
}

/**
 * A type representing additional parameters that can be passed to the
 * Anthropic API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

function extractToken(chunk: AIMessageChunk): string | undefined {
  if (typeof chunk.content === "string") {
    return chunk.content;
  } else if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "input" in chunk.content[0]
  ) {
    return typeof chunk.content[0].input === "string"
      ? chunk.content[0].input
      : JSON.stringify(chunk.content[0].input);
  } else if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "text" in chunk.content[0]
  ) {
    return chunk.content[0].text;
  }
  return undefined;
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

  streamUsage = true;

  constructor(fields?: Partial<AnthropicInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.anthropicApiKey =
      fields?.apiKey ??
      fields?.anthropicApiKey ??
      getEnvironmentVariable("ANTHROPIC_API_KEY");

    if (!this.anthropicApiKey) {
      throw new Error("Anthropic API key not found");
    }
    this.clientOptions = fields?.clientOptions ?? {};
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
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "anthropic",
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
    if ((tools as any[]).every((tool) => isOpenAITool(tool))) {
      // Formatted as OpenAI tool, convert to Anthropic tool
      return (tools as ToolDefinition[]).map((tc) => ({
        name: tc.function.name,
        description: tc.function.description,
        input_schema: tc.function.parameters as AnthropicTool.InputSchema,
      }));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((tools as any[]).some((tool) => isAnthropicTool(tool))) {
      throw new Error(`Can not pass in a mix of tool schemas to ChatAnthropic`);
    }

    return (tools as StructuredToolInterface[]).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.schema) as AnthropicTool.InputSchema,
    }));
  }

  override bindTools(
    tools: (
      | AnthropicTool
      | Record<string, unknown>
      | StructuredToolInterface
      | ToolDefinition
      | RunnableToolLike
    )[],
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
    const tool_choice:
      | MessageCreateParams.ToolChoiceAuto
      | MessageCreateParams.ToolChoiceAny
      | MessageCreateParams.ToolChoiceTool
      | undefined = handleToolChoice(options?.tool_choice);

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
    const coerceContentToString = !_toolsInParams({
      ...params,
      ...formattedMessages,
      stream: false,
    });

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

      const result = _makeMessageChunkFromAnthropicEvent(data, {
        streamUsage: !!(this.streamUsage || options.streamUsage),
        coerceContentToString,
        usageData,
      });
      if (!result) continue;

      const { chunk, usageData: updatedUsageData } = result;

      usageData = updatedUsageData;

      const newToolCallChunk = extractToolCallChunk(chunk);

      // Extract the text content token for text field and runManager.
      const token = extractToken(chunk);
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          // Just yield chunk as it is and tool_use will be concat by BaseChatModel._generateUncached().
          content: chunk.content,
          additional_kwargs: chunk.additional_kwargs,
          tool_call_chunks: newToolCallChunk ? [newToolCallChunk] : undefined,
          usage_metadata: chunk.usage_metadata,
          response_metadata: chunk.response_metadata,
          id: chunk.id,
        }),
        text: token ?? "",
      });

      if (token) {
        await runManager?.handleLLMNewToken(token);
      }
    }

    let usageMetadata: UsageMetadata | undefined;
    if (this.streamUsage || options.streamUsage) {
      usageMetadata = {
        input_tokens: usageData.input_tokens,
        output_tokens: usageData.output_tokens,
        total_tokens: usageData.input_tokens + usageData.output_tokens,
      };
    }
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: coerceContentToString ? "" : [],
        additional_kwargs: { usage: usageData },
        usage_metadata: usageMetadata,
      }),
      text: "",
    });
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
   * @param options
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
    if (!this.batchClient) {
      const options = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      if (!this.apiKey) {
        throw new Error("Missing Anthropic API key.");
      }
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
          input_schema: jsonSchema as AnthropicTool.InputSchema,
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
          input_schema: schema as AnthropicTool.InputSchema,
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
      tool_choice: {
        type: "tool",
        name: functionName,
      },
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
