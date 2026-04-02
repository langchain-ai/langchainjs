import type { ZodV3Like, ZodV4Like } from "../utils/types/zod.js";
import {
  AIMessage,
  type BaseMessage,
  BaseMessageChunk,
  type BaseMessageLike,
  coerceMessageLikeToMessage,
  AIMessageChunk,
  isAIMessageChunk,
  isBaseMessage,
  isAIMessage,
  MessageOutputVersion,
} from "../messages/index.js";
import {
  convertToOpenAIImageBlock,
  isURLContentBlock,
  isBase64ContentBlock,
} from "../messages/content/data.js";
import type { BasePromptValueInterface } from "../prompt_values.js";
import {
  LLMResult,
  RUN_KEY,
  type ChatGeneration,
  ChatGenerationChunk,
  type ChatResult,
  type Generation,
} from "../outputs.js";
import {
  BaseLanguageModel,
  type StructuredOutputMethodOptions,
  type ToolDefinition,
  type BaseLanguageModelCallOptions,
  type BaseLanguageModelInput,
  type BaseLanguageModelParams,
} from "./base.js";
import {
  CallbackManager,
  type CallbackManagerForLLMRun,
  type Callbacks,
} from "../callbacks/manager.js";
import type { RunnableConfig } from "../runnables/config.js";
import type { BaseCache } from "../caches/index.js";
import {
  StructuredToolInterface,
  StructuredToolParams,
} from "../tools/index.js";
import {
  Runnable,
  RunnableLambda,
  RunnableToolLike,
} from "../runnables/base.js";
import {
  AsyncGeneratorWithSetup,
  concat,
  IterableReadableStream,
} from "../utils/stream.js";
import {
  getSchemaDescription,
  InteropZodType,
  isInteropZodSchema,
} from "../utils/types/zod.js";
import { ModelAbortError } from "../errors/index.js";
import { callbackHandlerPrefersStreaming } from "../callbacks/base.js";
import { toJsonSchema } from "../utils/json_schema.js";
import { getEnvironmentVariable } from "../utils/env.js";
import { castStandardMessageContent, iife } from "./utils.js";
import {
  isSerializableSchema,
  type SerializableSchema,
} from "../utils/standard_schema.js";
import { assembleStructuredOutputPipeline } from "./structured_output.js";
import { ensureConfig } from "../runnables/config.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { UsageMetadata } from "../messages/metadata.js";
import type {
  ContentBlock as ProtocolContentBlock,
  ContentBlockFinishData,
  ContentBlockStartData,
  FinalizedContentBlock as ProtocolFinalizedContentBlock,
  FinishReason as ProtocolFinishReason,
  MessageFinishData,
  MessageStartData,
  MessagesData,
  UsageInfo as ProtocolUsageInfo,
} from "@langchain/protocol";

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolChoice = string | Record<string, any> | "auto" | "any";

/**
 * Represents a serialized chat model.
 */
export type SerializedChatModel = {
  _model: string;
  _type: string;
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

// todo?
/**
 * Represents a serialized large language model.
 */
export type SerializedLLM = {
  _model: string;
  _type: string;
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

/**
 * Represents the parameters for a base chat model.
 */
export type BaseChatModelParams = BaseLanguageModelParams & {
  /**
   * Whether to disable streaming.
   *
   * If streaming is bypassed, then `stream()` will defer to
   * `invoke()`.
   *
   * - If true, will always bypass streaming case.
   * - If false (default), will always use streaming case if available.
   */
  disableStreaming?: boolean;
  /**
   * Version of `AIMessage` output format to store in message content.
   *
   * `AIMessage.contentBlocks` will lazily parse the contents of `content` into a
   * standard format. This flag can be used to additionally store the standard format
   * as the message content, e.g., for serialization purposes.
   *
   * - "v0": provider-specific format in content (can lazily parse with `.contentBlocks`)
   * - "v1": standardized format in content (consistent with `.contentBlocks`)
   *
   * You can also set `LC_OUTPUT_VERSION` as an environment variable to "v1" to
   * enable this by default.
   *
   * @default "v0"
   */
  outputVersion?: MessageOutputVersion;
};

/**
 * Represents the call options for a base chat model.
 */
export type BaseChatModelCallOptions = BaseLanguageModelCallOptions & {
  /**
   * Specifies how the chat model should use tools.
   * @default undefined
   *
   * Possible values:
   * - "auto": The model may choose to use any of the provided tools, or none.
   * - "any": The model must use one of the provided tools.
   * - "none": The model must not use any tools.
   * - A string (not "auto", "any", or "none"): The name of a specific tool the model must use.
   * - An object: A custom schema specifying tool choice parameters. Specific to the provider.
   *
   * Note: Not all providers support tool_choice. An error will be thrown
   * if used with an unsupported model.
   */
  tool_choice?: ToolChoice;
  /**
   * Version of `AIMessage` output format to store in message content.
   *
   * `AIMessage.contentBlocks` will lazily parse the contents of `content` into a
   * standard format. This flag can be used to additionally store the standard format
   * as the message content, e.g., for serialization purposes.
   *
   * - "v0": provider-specific format in content (can lazily parse with `.contentBlocks`)
   * - "v1": standardized format in content (consistent with `.contentBlocks`)
   *
   * You can also set `LC_OUTPUT_VERSION` as an environment variable to "v1" to
   * enable this by default.
   *
   * @default "v0"
   */
  outputVersion?: MessageOutputVersion;
};

export type ChatModelStreamv2Event = MessagesData;
export type ChatModelStreamV2Event = ChatModelStreamv2Event;
export type ChatModelStreamv2 = IterableReadableStream<ChatModelStreamv2Event>;
export type ChatModelStreamV2 = ChatModelStreamv2;

type Streamv2AggregationState = {
  messageId?: string;
  blocks: Array<ProtocolContentBlock | undefined>;
  finalizedBlocks: Array<ProtocolFinalizedContentBlock | undefined>;
  usage?: ProtocolUsageInfo;
  finishReason?: ProtocolFinishReason;
  metadata?: Record<string, unknown>;
};

function getProtocolUsageInfo(
  usageMetadata?: UsageMetadata
): ProtocolUsageInfo | undefined {
  if (usageMetadata === undefined) {
    return undefined;
  }

  const cachedTokens =
    (usageMetadata.input_token_details?.cache_creation ?? 0) +
    (usageMetadata.input_token_details?.cache_read ?? 0);

  return {
    inputTokens: usageMetadata.input_tokens,
    outputTokens: usageMetadata.output_tokens,
    totalTokens: usageMetadata.total_tokens,
    cachedTokens: cachedTokens > 0 ? cachedTokens : undefined,
  };
}

function getUsageMetadata(
  usageInfo?: ProtocolUsageInfo
): UsageMetadata | undefined {
  if (usageInfo === undefined) {
    return undefined;
  }

  return {
    input_tokens: usageInfo.inputTokens ?? 0,
    output_tokens: usageInfo.outputTokens ?? 0,
    total_tokens:
      usageInfo.totalTokens ??
      (usageInfo.inputTokens ?? 0) + (usageInfo.outputTokens ?? 0),
    input_token_details:
      usageInfo.cachedTokens !== undefined
        ? {
            cache_read: usageInfo.cachedTokens,
          }
        : undefined,
  };
}

function getStreamv2Metadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function getBlockIndex(
  block: { index?: string | number } | ProtocolContentBlock,
  fallbackIndex: number
): number {
  const blockIndex =
    typeof block === "object" && block !== null && "index" in block
      ? (block as { index?: string | number }).index
      : undefined;

  if (typeof blockIndex === "number" && Number.isFinite(blockIndex)) {
    return block.index;
  }

  if (typeof blockIndex === "string") {
    const parsedIndex = Number(blockIndex);
    if (Number.isFinite(parsedIndex)) {
      return parsedIndex;
    }
  }

  return fallbackIndex;
}

function normalizeFinishReason(reason: unknown): ProtocolFinishReason {
  switch (reason) {
    case "tool_use":
      return "tool_use";
    case "length":
    case "max_tokens":
      return "length";
    case "content_filter":
      return "content_filter";
    case "stop":
    case "end_turn":
    default:
      return "stop";
  }
}

function toProtocolContentBlock(
  block: ContentBlock.Standard
): ProtocolContentBlock {
  return block as unknown as ProtocolContentBlock;
}

function getProtocolDeltaBlocks(
  chunk: BaseMessageChunk
): ProtocolContentBlock[] {
  const blocks: ProtocolContentBlock[] = [];

  if (typeof chunk.content === "string") {
    if (chunk.content.length > 0) {
      blocks.push({
        type: "text",
        text: chunk.content,
      });
    }
  } else if (Array.isArray(chunk.content)) {
    for (const block of chunk.content as Array<string | Record<string, unknown>>) {
      if (typeof block === "string") {
        if (block.length > 0) {
          blocks.push({
            type: "text",
            text: block,
          });
        }
      } else if (block !== undefined && block !== null) {
        blocks.push(block as unknown as ProtocolContentBlock);
      }
    }
  }

  if (isAIMessageChunk(chunk) && chunk.tool_call_chunks) {
    for (const toolCallChunk of chunk.tool_call_chunks) {
      blocks.push({
        type: "tool_call_chunk",
        id: toolCallChunk.id,
        name: toolCallChunk.name,
        args: toolCallChunk.args,
        index: toolCallChunk.index,
      });
    }
  }

  return blocks;
}

function getContentBlockStart(
  block: ProtocolContentBlock,
  index: number
): ProtocolContentBlock {
  switch (block.type) {
    case "text":
      return {
        ...block,
        index,
        text: "",
      };
    case "reasoning":
      return {
        ...block,
        index,
        reasoning: "",
      };
    case "tool_call":
      return {
        type: "tool_call_chunk",
        id: block.id,
        name: block.name,
        args: "",
        index,
      };
    case "tool_call_chunk":
      return {
        ...block,
        index,
        args: "",
      };
    case "server_tool_call":
      return {
        type: "server_tool_call_chunk",
        id: block.id,
        name: block.name,
        args: "",
        index,
      };
    case "server_tool_call_chunk":
      return {
        ...block,
        index,
        args: "",
      };
    default:
      return {
        ...block,
        index,
      };
  }
}

function finalizeContentBlock(
  block: ProtocolContentBlock
): ProtocolFinalizedContentBlock {
  if (block.type === "tool_call_chunk") {
    try {
      return {
        type: "tool_call",
        id: block.id ?? "",
        name: block.name ?? "",
        args:
          block.args && block.args.length > 0 ? JSON.parse(block.args) : {},
      };
    } catch (e) {
      return {
        type: "invalid_tool_call",
        id: block.id,
        name: block.name,
        args: block.args,
        error: e instanceof Error ? e.message : "Invalid tool call JSON.",
      };
    }
  }

  if (block.type === "server_tool_call_chunk") {
    try {
      return {
        type: "server_tool_call",
        id: block.id ?? "",
        name: block.name ?? "",
        args:
          block.args && block.args.length > 0 ? JSON.parse(block.args) : {},
      };
    } catch (e) {
      return {
        type: "non_standard",
        value: {
          type: "server_tool_call_chunk",
          id: block.id,
          name: block.name,
          args: block.args,
          error: e instanceof Error ? e.message : "Invalid server tool JSON.",
        },
      };
    }
  }

  return block as ProtocolFinalizedContentBlock;
}

function applyStreamv2Event(
  state: Streamv2AggregationState,
  event: ChatModelStreamv2Event
) {
  switch (event.event) {
    case "message-start":
      state.messageId = event.messageId ?? state.messageId;
      state.metadata = event.metadata ?? state.metadata;
      break;
    case "content-block-start":
    case "content-block-delta":
      {
        const currentBlock =
          state.blocks[event.index] ??
          getContentBlockStart(event.contentBlock, event.index);
        const nextBlock = { ...currentBlock } as Record<string, unknown>;
        for (const [key, value] of Object.entries(
          event.contentBlock as Record<string, unknown>
        )) {
          if (value === undefined) {
            continue;
          }
          const existingValue = nextBlock[key];
          if (existingValue === undefined) {
            nextBlock[key] = value;
          } else if (typeof existingValue === "string" && typeof value === "string") {
            nextBlock[key] = existingValue + value;
          } else if (typeof existingValue === "number" && typeof value === "number") {
            nextBlock[key] = value;
          } else if (
            typeof existingValue === "object" &&
            existingValue !== null &&
            typeof value === "object" &&
            value !== null
          ) {
            nextBlock[key] = concat(existingValue, value);
          } else {
            nextBlock[key] = value;
          }
        }
        state.blocks[event.index] = nextBlock as ProtocolContentBlock;
      }
      break;
    case "content-block-finish":
      state.finalizedBlocks[event.index] = event.contentBlock;
      break;
    case "message-finish":
      state.finishReason = event.reason;
      state.usage = event.usage ?? state.usage;
      state.metadata = {
        ...(state.metadata ?? {}),
        ...(event.metadata ?? {}),
      };
      break;
    default:
      break;
  }
}

function getFinalMessage(
  state: Streamv2AggregationState
): AIMessage {
  const blocks = state.blocks
    .map((block, index) => {
      if (state.finalizedBlocks[index] !== undefined) {
        return state.finalizedBlocks[index];
      }
      return block === undefined ? undefined : finalizeContentBlock(block);
    })
    .filter(
      (block): block is ProtocolFinalizedContentBlock => block !== undefined
    );

  const toolCalls = blocks
    .filter(
      (block): block is Extract<ProtocolFinalizedContentBlock, { type: "tool_call" }> =>
        block.type === "tool_call"
    )
    .map((block) => ({
      type: "tool_call" as const,
      id: block.id,
      name: block.name,
      args: block.args as Record<string, unknown>,
    }));

  const invalidToolCalls = blocks
    .filter(
      (
        block
      ): block is Extract<ProtocolFinalizedContentBlock, { type: "invalid_tool_call" }> =>
        block.type === "invalid_tool_call"
    )
    .map((block) => ({
      id: block.id,
      name: block.name,
      args: block.args,
      error: block.error,
      type: "invalid_tool_call" as const,
    }));

  return new AIMessage({
    id: state.messageId,
    contentBlocks: blocks as unknown as Array<ContentBlock.Standard>,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    invalid_tool_calls:
      invalidToolCalls.length > 0 ? invalidToolCalls : undefined,
    usage_metadata: getUsageMetadata(state.usage),
    response_metadata: {
      ...(state.metadata ?? {}),
      output_version: "v1",
      stop_reason: state.finishReason ?? "stop",
    },
  });
}

function _formatForTracing(messages: BaseMessage[]): BaseMessage[] {
  const messagesToTrace: BaseMessage[] = [];
  for (const message of messages) {
    let messageToTrace = message;
    if (Array.isArray(message.content)) {
      for (let idx = 0; idx < message.content.length; idx++) {
        const block = message.content[idx];
        if (isURLContentBlock(block) || isBase64ContentBlock(block)) {
          if (messageToTrace === message) {
            // Also shallow-copy content
            // oxlint-disable-next-line @typescript-eslint/no-explicit-any
            messageToTrace = new (message.constructor as any)({
              ...messageToTrace,
              content: [
                ...message.content.slice(0, idx),
                convertToOpenAIImageBlock(block),
                ...message.content.slice(idx + 1),
              ],
            });
          }
        }
      }
    }
    messagesToTrace.push(messageToTrace);
  }
  return messagesToTrace;
}

export type LangSmithParams = {
  ls_provider?: string;
  ls_model_name?: string;
  ls_model_type: "chat";
  ls_temperature?: number;
  ls_max_tokens?: number;
  ls_stop?: Array<string>;
  ls_integration?: string;
};

export type BindToolsInput =
  | StructuredToolInterface
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  | Record<string, any>
  | ToolDefinition
  | RunnableToolLike
  | StructuredToolParams;

/**
 * Base class for chat models. It extends the BaseLanguageModel class and
 * provides methods for generating chat based on input messages.
 */
export abstract class BaseChatModel<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  // TODO: Fix the parameter order on the next minor version.
  OutputMessageType extends BaseMessageChunk = AIMessageChunk,
> extends BaseLanguageModel<OutputMessageType, CallOptions> {
  // Backwards compatibility since fields have been moved to RunnableConfig
  declare ParsedCallOptions: Omit<
    CallOptions,
    Exclude<keyof RunnableConfig, "signal" | "timeout" | "maxConcurrency">
  >;

  // Only ever instantiated in main LangChain
  lc_namespace = ["langchain", "chat_models", this._llmType()];

  disableStreaming = false;

  outputVersion?: MessageOutputVersion;

  get callKeys(): string[] {
    return [...super.callKeys, "outputVersion"];
  }

  constructor(fields: BaseChatModelParams) {
    super(fields);
    this.outputVersion = iife(() => {
      const outputVersion =
        fields.outputVersion ?? getEnvironmentVariable("LC_OUTPUT_VERSION");
      if (outputVersion && ["v0", "v1"].includes(outputVersion)) {
        return outputVersion as "v0" | "v1";
      }
      return "v0";
    });
  }

  _combineLLMOutput?(
    ...llmOutputs: LLMResult["llmOutput"][]
  ): LLMResult["llmOutput"];

  protected _separateRunnableConfigFromCallOptionsCompat(
    options?: Partial<CallOptions>
  ): [RunnableConfig, this["ParsedCallOptions"]] {
    // For backwards compat, keep `signal` in both runnableConfig and callOptions
    const [runnableConfig, callOptions] =
      super._separateRunnableConfigFromCallOptions(options);
    (callOptions as this["ParsedCallOptions"]).signal = runnableConfig.signal;
    return [runnableConfig, callOptions as this["ParsedCallOptions"]];
  }

  /**
   * Bind tool-like objects to this chat model.
   *
   * @param tools A list of tool definitions to bind to this chat model.
   * Can be a structured tool, an OpenAI formatted tool, or an object
   * matching the provider's specific tool schema.
   * @param kwargs Any additional parameters to bind.
   */
  bindTools?(
    tools: BindToolsInput[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, OutputMessageType, CallOptions>;

  /**
   * Invokes the chat model with a single input.
   * @param input The input for the language model.
   * @param options The call options.
   * @returns A Promise that resolves to a BaseMessageChunk.
   */
  async invoke(
    input: BaseLanguageModelInput,
    options?: Partial<CallOptions>
  ): Promise<OutputMessageType> {
    const promptValue = BaseChatModel._convertInputToPromptValue(input);
    const result = await this.generatePrompt(
      [promptValue],
      options,
      options?.callbacks
    );
    const chatGeneration = result.generations[0][0] as ChatGeneration;
    // TODO: Remove cast after figuring out inheritance
    return chatGeneration.message as OutputMessageType;
  }

  // oxlint-disable-next-line require-yield
  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    throw new Error("Not implemented.");
  }

  async *_streamResponseEvents(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamv2Event> {
    if (
      !this.disableStreaming &&
      this._streamResponseChunks !== BaseChatModel.prototype._streamResponseChunks
    ) {
      let finalChunk: ChatGenerationChunk | undefined;
      let messageStarted = false;
      const startedBlockIndices = new Set<number>();

      for await (const chunk of this._streamResponseChunks(
        messages,
        options,
        runManager
      )) {
        const metadata = getStreamv2Metadata({
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        });

        if (!messageStarted) {
          messageStarted = true;
          yield {
            event: "message-start",
            messageId: chunk.message.id,
            metadata,
          } satisfies MessageStartData;
        }

        for (const [fallbackIndex, block] of getProtocolDeltaBlocks(
          chunk.message
        ).entries()) {
          const index = getBlockIndex(block, fallbackIndex);
          if (!startedBlockIndices.has(index)) {
            startedBlockIndices.add(index);
            yield {
              event: "content-block-start",
              index,
              contentBlock: getContentBlockStart(block, index),
            } satisfies ContentBlockStartData;
          }
          yield {
            event: "content-block-delta",
            index,
            contentBlock: {
              ...block,
              index,
            },
          };
        }

        finalChunk = finalChunk === undefined ? chunk : finalChunk.concat(chunk);
      }

      if (finalChunk === undefined) {
        throw new Error("Received empty response from chat model call.");
      }

      const finalMetadata = getStreamv2Metadata({
        ...finalChunk.generationInfo,
        ...finalChunk.message.response_metadata,
      });

      for (const [fallbackIndex, block] of finalChunk.message.contentBlocks.entries()) {
        const protocolBlock = toProtocolContentBlock(block);
        const index = getBlockIndex(protocolBlock, fallbackIndex);
        if (!startedBlockIndices.has(index)) {
          yield {
            event: "content-block-start",
            index,
            contentBlock: getContentBlockStart(protocolBlock, index),
          } satisfies ContentBlockStartData;
        }
        yield {
          event: "content-block-finish",
          index,
          contentBlock: finalizeContentBlock({
            ...protocolBlock,
            index,
          }),
        } satisfies ContentBlockFinishData;
      }

      yield {
        event: "message-finish",
        reason: normalizeFinishReason(finalMetadata?.stop_reason),
        usage: getProtocolUsageInfo(
          isAIMessageChunk(finalChunk.message)
            ? finalChunk.message.usage_metadata
            : undefined
        ),
        metadata: finalMetadata,
      } satisfies MessageFinishData;

      return;
    }

    const result = await this._generate(messages, options, runManager);
    const generation = result.generations[0];
    if (generation === undefined) {
      throw new Error("Received empty response from chat model call.");
    }

    const metadata = getStreamv2Metadata({
      ...generation.generationInfo,
      ...generation.message.response_metadata,
    });

    yield {
      event: "message-start",
      messageId: generation.message.id,
      metadata,
    } satisfies MessageStartData;

    for (const [fallbackIndex, block] of generation.message.contentBlocks.entries()) {
      const protocolBlock = toProtocolContentBlock(block);
      const index = getBlockIndex(protocolBlock, fallbackIndex);
      yield {
        event: "content-block-start",
        index,
        contentBlock: getContentBlockStart(protocolBlock, index),
      } satisfies ContentBlockStartData;
      yield {
        event: "content-block-finish",
        index,
        contentBlock: finalizeContentBlock({
          ...protocolBlock,
          index,
        }),
      } satisfies ContentBlockFinishData;
    }

    yield {
      event: "message-finish",
      reason: normalizeFinishReason(metadata?.stop_reason),
      usage: getProtocolUsageInfo(
        isAIMessage(generation.message) ? generation.message.usage_metadata : undefined
      ),
      metadata,
    } satisfies MessageFinishData;
  }

  async *_streamv2Iterator(
    input: BaseLanguageModelInput,
    options?: Partial<CallOptions>
  ): AsyncGenerator<ChatModelStreamv2Event> {
    const prompt = BaseChatModel._convertInputToPromptValue(input);
    const messages = prompt.toChatMessages();
    const [runnableConfig, callOptions] =
      this._separateRunnableConfigFromCallOptionsCompat(options);

    const inheritableMetadata = {
      ...runnableConfig.metadata,
      ...this.getLsParamsWithDefaults(callOptions),
    };
    const callbackManager_ = await CallbackManager.configure(
      runnableConfig.callbacks,
      this.callbacks,
      runnableConfig.tags,
      this.tags,
      inheritableMetadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const extra = {
      options: callOptions,
      invocation_params: this?.invocationParams(callOptions),
      batch_size: 1,
    };
    const runManagers = await callbackManager_?.handleChatModelStart(
      this.toJSON(),
      [_formatForTracing(messages)],
      runnableConfig.runId,
      undefined,
      extra,
      undefined,
      undefined,
      runnableConfig.runName
    );

    const state: Streamv2AggregationState = {
      blocks: [],
      finalizedBlocks: [],
      messageId:
        runManagers?.[0]?.runId !== undefined
          ? `run-${runManagers[0].runId}`
          : undefined,
    };

    try {
      for await (const event of this._streamResponseEvents(
        messages,
        callOptions,
        runManagers?.[0]
      )) {
        callOptions.signal?.throwIfAborted();
        const normalizedEvent =
          event.event === "message-start" && event.messageId == null
            ? {
                ...event,
                messageId: state.messageId,
              }
            : event;
        applyStreamv2Event(state, normalizedEvent);
        yield normalizedEvent;
      }
      callOptions.signal?.throwIfAborted();
    } catch (err) {
      await Promise.all(
        (runManagers ?? []).map((runManager) =>
          runManager?.handleLLMError(err)
        )
      );
      throw err;
    }

    const finalMessage = getFinalMessage(state);
    const llmOutput =
      finalMessage.usage_metadata === undefined
        ? undefined
        : {
            tokenUsage: {
              promptTokens: finalMessage.usage_metadata.input_tokens,
              completionTokens: finalMessage.usage_metadata.output_tokens,
              totalTokens: finalMessage.usage_metadata.total_tokens,
            },
          };

    await Promise.all(
      (runManagers ?? []).map((runManager) =>
        runManager?.handleLLMEnd({
          generations: [[{ text: finalMessage.text, message: finalMessage } as ChatGeneration]],
          llmOutput,
        })
      )
    );
  }

  async streamv2(
    input: BaseLanguageModelInput,
    options?: Partial<CallOptions>
  ): Promise<ChatModelStreamv2> {
    const config = ensureConfig(options);
    const wrappedGenerator = new AsyncGeneratorWithSetup({
      generator: this._streamv2Iterator(input, config as Partial<CallOptions>),
      config,
    });
    await wrappedGenerator.setup;
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
  }

  async streamV2(
    input: BaseLanguageModelInput,
    options?: Partial<CallOptions>
  ): Promise<ChatModelStreamv2> {
    return this.streamv2(input, options);
  }

  async *_streamIterator(
    input: BaseLanguageModelInput,
    options?: Partial<CallOptions>
  ): AsyncGenerator<OutputMessageType> {
    // Subclass check required to avoid double callbacks with default implementation
    if (
      this._streamResponseChunks ===
        BaseChatModel.prototype._streamResponseChunks ||
      this.disableStreaming
    ) {
      yield this.invoke(input, options);
    } else {
      const prompt = BaseChatModel._convertInputToPromptValue(input);
      const messages = prompt.toChatMessages();
      const [runnableConfig, callOptions] =
        this._separateRunnableConfigFromCallOptionsCompat(options);

      const inheritableMetadata = {
        ...runnableConfig.metadata,
        ...this.getLsParamsWithDefaults(callOptions),
      };
      const callbackManager_ = await CallbackManager.configure(
        runnableConfig.callbacks,
        this.callbacks,
        runnableConfig.tags,
        this.tags,
        inheritableMetadata,
        this.metadata,
        { verbose: this.verbose }
      );
      const extra = {
        options: callOptions,
        invocation_params: this?.invocationParams(callOptions),
        batch_size: 1,
      };
      const outputVersion = callOptions.outputVersion ?? this.outputVersion;
      const runManagers = await callbackManager_?.handleChatModelStart(
        this.toJSON(),
        [_formatForTracing(messages)],
        runnableConfig.runId,
        undefined,
        extra,
        undefined,
        undefined,
        runnableConfig.runName
      );
      let generationChunk: ChatGenerationChunk | undefined;
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      let llmOutput: Record<string, any> | undefined;
      try {
        for await (const chunk of this._streamResponseChunks(
          messages,
          callOptions,
          runManagers?.[0]
        )) {
          callOptions.signal?.throwIfAborted();
          if (chunk.message.id == null) {
            const runId = runManagers?.at(0)?.runId;
            if (runId != null) chunk.message._updateId(`run-${runId}`);
          }
          chunk.message.response_metadata = {
            ...chunk.generationInfo,
            ...chunk.message.response_metadata,
          };
          if (outputVersion === "v1") {
            yield castStandardMessageContent(
              chunk.message
            ) as OutputMessageType;
          } else {
            yield chunk.message as OutputMessageType;
          }
          if (!generationChunk) {
            generationChunk = chunk;
          } else {
            generationChunk = generationChunk.concat(chunk);
          }
          if (
            isAIMessageChunk(chunk.message) &&
            chunk.message.usage_metadata !== undefined
          ) {
            llmOutput = {
              tokenUsage: {
                promptTokens: chunk.message.usage_metadata.input_tokens,
                completionTokens: chunk.message.usage_metadata.output_tokens,
                totalTokens: chunk.message.usage_metadata.total_tokens,
              },
            };
          }
        }
        // Throw error if stream ended due to abort (provider returned early)
        callOptions.signal?.throwIfAborted();
      } catch (err) {
        await Promise.all(
          (runManagers ?? []).map((runManager) =>
            runManager?.handleLLMError(err)
          )
        );
        throw err;
      }
      await Promise.all(
        (runManagers ?? []).map((runManager) =>
          runManager?.handleLLMEnd({
            // TODO: Remove cast after figuring out inheritance
            generations: [[generationChunk as ChatGeneration]],
            llmOutput,
          })
        )
      );
    }
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const providerName = this.getName().startsWith("Chat")
      ? this.getName().replace("Chat", "")
      : this.getName();

    return {
      ls_model_type: "chat",
      ls_stop: options.stop,
      ls_provider: providerName,
    };
  }

  /**
   * Wraps getLsParams() and always appends ls_integration.
   * This ensures the integration tag is present even when
   * partner packages fully override getLsParams().
   */
  getLsParamsWithDefaults(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ...this.getLsParams(options),
      ls_integration: "langchain_chat_model",
    };
  }

  /** @ignore */
  async _generateUncached(
    messages: BaseMessageLike[][],
    parsedOptions: this["ParsedCallOptions"],
    handledOptions: RunnableConfig,
    startedRunManagers?: CallbackManagerForLLMRun[]
  ): Promise<LLMResult> {
    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    let runManagers: CallbackManagerForLLMRun[] | undefined;
    if (
      startedRunManagers !== undefined &&
      startedRunManagers.length === baseMessages.length
    ) {
      runManagers = startedRunManagers;
    } else {
      const inheritableMetadata = {
        ...handledOptions.metadata,
        ...this.getLsParamsWithDefaults(parsedOptions),
      };
      // create callback manager and start run
      const callbackManager_ = await CallbackManager.configure(
        handledOptions.callbacks,
        this.callbacks,
        handledOptions.tags,
        this.tags,
        inheritableMetadata,
        this.metadata,
        { verbose: this.verbose }
      );
      const extra = {
        options: parsedOptions,
        invocation_params: this?.invocationParams(parsedOptions),
        batch_size: 1,
      };
      runManagers = await callbackManager_?.handleChatModelStart(
        this.toJSON(),
        baseMessages.map(_formatForTracing),
        handledOptions.runId,
        undefined,
        extra,
        undefined,
        undefined,
        handledOptions.runName
      );
    }
    const outputVersion = parsedOptions.outputVersion ?? this.outputVersion;
    const generations: ChatGeneration[][] = [];
    const llmOutputs: LLMResult["llmOutput"][] = [];
    // Even if stream is not explicitly called, check if model is implicitly
    // called from streamEvents() or streamLog() to get all streamed events.
    // Bail out if _streamResponseChunks not overridden
    const hasStreamingHandler = !!runManagers?.[0].handlers.find(
      callbackHandlerPrefersStreaming
    );
    if (
      hasStreamingHandler &&
      !this.disableStreaming &&
      baseMessages.length === 1 &&
      this._streamResponseChunks !==
        BaseChatModel.prototype._streamResponseChunks
    ) {
      try {
        const stream = await this._streamResponseChunks(
          baseMessages[0],
          parsedOptions,
          runManagers?.[0]
        );
        let aggregated: ChatGenerationChunk | undefined;
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        let llmOutput: Record<string, any> | undefined;
        for await (const chunk of stream) {
          // Check for abort signal - throw ModelAbortError with partial output
          if (parsedOptions.signal?.aborted) {
            const partialMessage = aggregated?.message as
              | AIMessageChunk
              | undefined;
            throw new ModelAbortError(
              "Model invocation was aborted.",
              partialMessage
            );
          }
          if (chunk.message.id == null) {
            const runId = runManagers?.at(0)?.runId;
            if (runId != null) chunk.message._updateId(`run-${runId}`);
          }
          if (aggregated === undefined) {
            aggregated = chunk;
          } else {
            aggregated = concat(aggregated, chunk);
          }
          if (
            isAIMessageChunk(chunk.message) &&
            chunk.message.usage_metadata !== undefined
          ) {
            llmOutput = {
              tokenUsage: {
                promptTokens: chunk.message.usage_metadata.input_tokens,
                completionTokens: chunk.message.usage_metadata.output_tokens,
                totalTokens: chunk.message.usage_metadata.total_tokens,
              },
            };
          }
        }
        // Check if stream ended due to abort (provider returned early)
        if (parsedOptions.signal?.aborted) {
          const partialMessage = aggregated?.message as
            | AIMessageChunk
            | undefined;
          throw new ModelAbortError(
            "Model invocation was aborted.",
            partialMessage
          );
        }
        if (aggregated === undefined) {
          throw new Error("Received empty response from chat model call.");
        }
        generations.push([aggregated]);
        await runManagers?.[0].handleLLMEnd({
          generations,
          llmOutput,
        });
      } catch (e) {
        await runManagers?.[0].handleLLMError(e);
        throw e;
      }
    } else {
      // generate results
      const results = await Promise.allSettled(
        baseMessages.map(async (messageList, i) => {
          const generateResults = await this._generate(
            messageList,
            { ...parsedOptions, promptIndex: i },
            runManagers?.[i]
          );
          if (outputVersion === "v1") {
            for (const generation of generateResults.generations) {
              generation.message = castStandardMessageContent(
                generation.message
              );
            }
          }
          return generateResults;
        })
      );
      // handle results
      await Promise.all(
        results.map(async (pResult, i) => {
          if (pResult.status === "fulfilled") {
            const result = pResult.value;
            for (const generation of result.generations) {
              if (generation.message.id == null) {
                const runId = runManagers?.at(0)?.runId;
                if (runId != null) generation.message._updateId(`run-${runId}`);
              }
              generation.message.response_metadata = {
                ...generation.generationInfo,
                ...generation.message.response_metadata,
              };
            }
            if (result.generations.length === 1) {
              result.generations[0].message.response_metadata = {
                ...result.llmOutput,
                ...result.generations[0].message.response_metadata,
              };
            }
            generations[i] = result.generations;
            llmOutputs[i] = result.llmOutput;
            return runManagers?.[i]?.handleLLMEnd({
              generations: [result.generations],
              llmOutput: result.llmOutput,
            });
          } else {
            // status === "rejected"
            await runManagers?.[i]?.handleLLMError(pResult.reason);
            return Promise.reject(pResult.reason);
          }
        })
      );
    }
    // create combined output
    const output: LLMResult = {
      generations,
      llmOutput: llmOutputs.length
        ? this._combineLLMOutput?.(...llmOutputs)
        : undefined,
    };
    Object.defineProperty(output, RUN_KEY, {
      value: runManagers
        ? { runIds: runManagers?.map((manager) => manager.runId) }
        : undefined,
      configurable: true,
    });
    return output;
  }

  async _generateCached({
    messages,
    cache,
    llmStringKey,
    parsedOptions,
    handledOptions,
  }: {
    messages: BaseMessageLike[][];
    cache: BaseCache<Generation[]>;
    llmStringKey: string;
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    parsedOptions: any;
    handledOptions: RunnableConfig;
  }): Promise<
    LLMResult & {
      missingPromptIndices: number[];
      startedRunManagers?: CallbackManagerForLLMRun[];
    }
  > {
    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    const inheritableMetadata = {
      ...handledOptions.metadata,
      ...this.getLsParamsWithDefaults(parsedOptions),
    };
    // create callback manager and start run
    const callbackManager_ = await CallbackManager.configure(
      handledOptions.callbacks,
      this.callbacks,
      handledOptions.tags,
      this.tags,
      inheritableMetadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const extra = {
      options: parsedOptions,
      invocation_params: this?.invocationParams(parsedOptions),
      batch_size: 1,
    };
    const runManagers = await callbackManager_?.handleChatModelStart(
      this.toJSON(),
      baseMessages.map(_formatForTracing),
      handledOptions.runId,
      undefined,
      extra,
      undefined,
      undefined,
      handledOptions.runName
    );

    // generate results
    const missingPromptIndices: number[] = [];
    const results = await Promise.allSettled(
      baseMessages.map(async (baseMessage, index) => {
        // Join all content into one string for the prompt index
        const prompt =
          BaseChatModel._convertInputToPromptValue(baseMessage).toString();
        const result = await cache.lookup(prompt, llmStringKey);

        if (result == null) {
          missingPromptIndices.push(index);
        }

        return result;
      })
    );

    // Map run managers to the results before filtering out null results
    // Null results are just absent from the cache.
    const cachedResults = results
      .map((result, index) => ({ result, runManager: runManagers?.[index] }))
      .filter(
        ({ result }) =>
          (result.status === "fulfilled" && result.value != null) ||
          result.status === "rejected"
      );

    // Handle results and call run managers
    const outputVersion = parsedOptions.outputVersion ?? this.outputVersion;
    const generations: Generation[][] = [];
    await Promise.all(
      cachedResults.map(async ({ result: promiseResult, runManager }, i) => {
        if (promiseResult.status === "fulfilled") {
          const result = promiseResult.value as Generation[];
          generations[i] = result.map((result) => {
            if (
              "message" in result &&
              isBaseMessage(result.message) &&
              isAIMessage(result.message)
            ) {
              result.message.usage_metadata = {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
              };
              if (outputVersion === "v1") {
                result.message = castStandardMessageContent(result.message);
              }
            }
            result.generationInfo = {
              ...result.generationInfo,
              tokenUsage: {},
            };
            return result;
          });
          if (result.length) {
            await runManager?.handleLLMNewToken(result[0].text);
          }
          return runManager?.handleLLMEnd(
            {
              generations: [result],
            },
            undefined,
            undefined,
            undefined,
            {
              cached: true,
            }
          );
        } else {
          // status === "rejected"
          await runManager?.handleLLMError(
            promiseResult.reason,
            undefined,
            undefined,
            undefined,
            {
              cached: true,
            }
          );
          return Promise.reject(promiseResult.reason);
        }
      })
    );

    const output = {
      generations,
      missingPromptIndices,
      startedRunManagers: runManagers,
    };

    // This defines RUN_KEY as a non-enumerable property on the output object
    // so that it is not serialized when the output is stringified, and so that
    // it isnt included when listing the keys of the output object.
    Object.defineProperty(output, RUN_KEY, {
      value: runManagers
        ? { runIds: runManagers?.map((manager) => manager.runId) }
        : undefined,
      configurable: true,
    });

    return output;
  }

  /**
   * Generates chat based on the input messages.
   * @param messages An array of arrays of BaseMessage instances.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to an LLMResult.
   */
  async generate(
    messages: BaseMessageLike[][],
    options?: string[] | Partial<CallOptions>,
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    // parse call options
    let parsedOptions: Partial<CallOptions> | undefined;
    if (Array.isArray(options)) {
      parsedOptions = { stop: options } as Partial<CallOptions>;
    } else {
      parsedOptions = options;
    }

    const baseMessages = messages.map((messageList) =>
      messageList.map(coerceMessageLikeToMessage)
    );

    const [runnableConfig, callOptions] =
      this._separateRunnableConfigFromCallOptionsCompat(parsedOptions);
    runnableConfig.callbacks = runnableConfig.callbacks ?? callbacks;

    if (!this.cache) {
      return this._generateUncached(baseMessages, callOptions, runnableConfig);
    }

    const { cache } = this;
    const llmStringKey = this._getSerializedCacheKeyParametersForCall(
      callOptions as CallOptions
    );

    const { generations, missingPromptIndices, startedRunManagers } =
      await this._generateCached({
        messages: baseMessages,
        cache,
        llmStringKey,
        parsedOptions: callOptions,
        handledOptions: runnableConfig,
      });

    let llmOutput = {};
    if (missingPromptIndices.length > 0) {
      const results = await this._generateUncached(
        missingPromptIndices.map((i) => baseMessages[i]),
        callOptions,
        runnableConfig,
        startedRunManagers !== undefined
          ? missingPromptIndices.map((i) => startedRunManagers?.[i])
          : undefined
      );
      await Promise.all(
        results.generations.map(async (generation, index) => {
          const promptIndex = missingPromptIndices[index];
          generations[promptIndex] = generation;
          // Join all content into one string for the prompt index
          const prompt = BaseChatModel._convertInputToPromptValue(
            baseMessages[promptIndex]
          ).toString();
          return cache.update(prompt, llmStringKey, generation);
        })
      );
      llmOutput = results.llmOutput ?? {};
    }

    return { generations, llmOutput } as LLMResult;
  }

  /**
   * Get the parameters used to invoke the model
   */
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  invocationParams(_options?: this["ParsedCallOptions"]): any {
    return {};
  }

  _modelType(): string {
    return "base_chat_model" as const;
  }

  abstract _llmType(): string;

  /**
   * Generates a prompt based on the input prompt values.
   * @param promptValues An array of BasePromptValue instances.
   * @param options The call options or an array of stop sequences.
   * @param callbacks The callbacks for the language model.
   * @returns A Promise that resolves to an LLMResult.
   */
  async generatePrompt(
    promptValues: BasePromptValueInterface[],
    options?: string[] | Partial<CallOptions>,
    callbacks?: Callbacks
  ): Promise<LLMResult> {
    const promptMessages: BaseMessage[][] = promptValues.map((promptValue) =>
      promptValue.toChatMessages()
    );
    return this.generate(promptMessages, options, callbacks);
  }

  abstract _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema: SerializableSchema<RunOutput>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema: SerializableSchema<RunOutput>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | ZodV4Like<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | ZodV4Like<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | ZodV3Like<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | ZodV3Like<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      > {
    if (typeof this.bindTools !== "function") {
      throw new Error(
        `Chat model must implement ".bindTools()" to use withStructuredOutput.`
      );
    }
    if (config?.strict) {
      throw new Error(
        `"strict" mode is not supported for this model by default.`
      );
    }

    const schema = outputSchema;
    const name = config?.name;
    const description =
      getSchemaDescription(schema) ?? "A function available to call.";
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(
        `Base withStructuredOutput implementation only supports "functionCalling" as a method.`
      );
    }

    let functionName = name ?? "extract";
    if (
      !isInteropZodSchema(schema) &&
      !isSerializableSchema(schema) &&
      "name" in schema
    ) {
      functionName = schema.name;
    }

    const asJsonSchema =
      isInteropZodSchema(schema) || isSerializableSchema(schema)
        ? toJsonSchema(schema)
        : schema;

    const tools: ToolDefinition[] = [
      {
        type: "function",
        function: {
          name: functionName,
          description,
          parameters: asJsonSchema,
        },
      },
    ];

    const llm = this.bindTools(tools);
    const outputParser = RunnableLambda.from<OutputMessageType, RunOutput>(
      (input: BaseMessageChunk): RunOutput => {
        if (!AIMessageChunk.isInstance(input)) {
          throw new Error("Input is not an AIMessageChunk.");
        }
        if (!input.tool_calls || input.tool_calls.length === 0) {
          throw new Error("No tool calls found in the response.");
        }
        const toolCall = input.tool_calls.find(
          (tc) => tc.name === functionName
        );
        if (!toolCall) {
          throw new Error(`No tool call found with name ${functionName}.`);
        }
        return toolCall.args as RunOutput;
      }
    );

    return assembleStructuredOutputPipeline(
      llm,
      outputParser,
      includeRaw,
      includeRaw ? "StructuredOutputRunnable" : "StructuredOutput"
    );
  }
}

/**
 * An abstract class that extends BaseChatModel and provides a simple
 * implementation of _generate.
 */
export abstract class SimpleChatModel<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
> extends BaseChatModel<CallOptions> {
  abstract _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string>;

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const text = await this._call(messages, options, runManager);
    const message = new AIMessage(text);
    if (typeof message.content !== "string") {
      throw new Error(
        "Cannot generate with a simple chat model when output is not a string."
      );
    }
    return {
      generations: [
        {
          text: message.content,
          message,
        },
      ],
    };
  }
}
