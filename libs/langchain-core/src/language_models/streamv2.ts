import {
  CallbackManager,
  type CallbackManagerForLLMRun,
  type Callbacks,
} from "../callbacks/manager.js";
import {
  AIMessage,
  isAIMessage,
  isAIMessageChunk,
  type BaseMessage,
  type BaseMessageChunk,
} from "../messages/index.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { UsageMetadata } from "../messages/metadata.js";
import {
  type ChatGeneration,
  ChatGenerationChunk,
  type ChatResult,
} from "../outputs.js";
import { ensureConfig, type RunnableConfig } from "../runnables/config.js";
import {
  AsyncGeneratorWithSetup,
  concat,
  IterableReadableStream,
} from "../utils/stream.js";
import type { BaseLanguageModelInput } from "./base.js";
import type {
  BaseChatModelCallOptions,
  ChatModelStreamv2,
  ChatModelStreamv2Event,
  LangSmithParams,
} from "./chat_models.js";
import type {
  ContentBlock as ProtocolContentBlock,
  ContentBlockFinishData,
  ContentBlockStartData,
  FinalizedContentBlock as ProtocolFinalizedContentBlock,
  FinishReason as ProtocolFinishReason,
  MessageFinishData,
  MessageStartData,
  UsageInfo as ProtocolUsageInfo,
} from "@langchain/protocol";

/**
 * Formats traced chat messages before they are sent to callback handlers.
 */
export type Streamv2TraceFormatter = (messages: BaseMessage[]) => BaseMessage[];

/**
 * Minimal shape needed from a chat model to run the shared streamv2 helpers.
 */
export type Streamv2ModelLike<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
> = {
  disableStreaming: boolean;
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  verbose: boolean;
  _streamResponseChunks(
    messages: BaseMessage[],
    options: CallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk>;
  _streamResponseEvents(
    messages: BaseMessage[],
    options: CallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamv2Event>;
  _generate(
    messages: BaseMessage[],
    options: CallOptions,
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult>;
  _separateRunnableConfigFromCallOptionsCompat(
    options?: Partial<CallOptions>
  ): [RunnableConfig, CallOptions];
  getLsParamsWithDefaults(options: CallOptions): LangSmithParams;
  invocationParams(options?: CallOptions): unknown;
  toJSON(): import("../load/serializable.js").Serialized;
};

type Streamv2AggregationState = {
  messageId?: string;
  blocks: Array<ProtocolContentBlock | undefined>;
  finalizedBlocks: Array<ProtocolFinalizedContentBlock | undefined>;
  usage?: ProtocolUsageInfo;
  finishReason?: ProtocolFinishReason;
  metadata?: Record<string, unknown>;
};

/**
 * Converts LangChain usage metadata into protocol usage info.
 */
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

/**
 * Converts protocol usage info back into LangChain usage metadata.
 */
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

/**
 * Drops empty metadata objects so emitted events stay compact.
 */
function getStreamv2Metadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Resolves the protocol block index, falling back to the stream order when a
 * provider does not include one on the delta.
 */
function getBlockIndex(
  block: { index?: string | number } | ProtocolContentBlock,
  fallbackIndex: number
): number {
  const blockIndex =
    typeof block === "object" && block !== null && "index" in block
      ? (block as { index?: string | number }).index
      : undefined;

  if (typeof blockIndex === "number" && Number.isFinite(blockIndex)) {
    return blockIndex;
  }

  if (typeof blockIndex === "string") {
    const parsedIndex = Number(blockIndex);
    if (Number.isFinite(parsedIndex)) {
      return parsedIndex;
    }
  }

  return fallbackIndex;
}

/**
 * Normalizes provider stop reasons into the protocol finish reason enum.
 */
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

/**
 * Reinterprets a standardized content block as its protocol counterpart.
 */
function toProtocolContentBlock(
  block: ContentBlock.Standard
): ProtocolContentBlock {
  return block as unknown as ProtocolContentBlock;
}

/**
 * Extracts incremental protocol blocks from a streamed message chunk.
 *
 * The fallback implementation uses raw chunk content rather than
 * `contentBlocks()` so that partial tool call JSON is preserved as deltas
 * instead of being upgraded too early into finalized tool calls.
 */
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

/**
 * Produces the synthetic `content-block-start` payload for a given block.
 */
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

/**
 * Finalizes an in-flight protocol content block for `content-block-finish`.
 */
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

/**
 * Applies one protocol event to the in-memory aggregation state used to rebuild
 * the final `AIMessage` passed to callbacks and awaiters.
 */
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
        /**
         * Start and delta events both update the mutable block state.
         * This mirrors how consumers reconstruct protocol messages incrementally.
         */
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
          } else if (
            typeof existingValue === "string" &&
            typeof value === "string"
          ) {
            nextBlock[key] = existingValue + value;
          } else if (
            typeof existingValue === "number" &&
            typeof value === "number"
          ) {
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

/**
 * Rebuilds the final `AIMessage` from the aggregated streamv2 state.
 */
function getFinalMessage(state: Streamv2AggregationState): AIMessage {
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
      (
        block
      ): block is Extract<ProtocolFinalizedContentBlock, { type: "tool_call" }> =>
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
      ): block is Extract<
        ProtocolFinalizedContentBlock,
        { type: "invalid_tool_call" }
      > => block.type === "invalid_tool_call"
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

/**
 * Shared implementation for `_streamResponseEvents`.
 *
 * This helper handles both stream-capable models and non-streaming fallbacks:
 * - if a model overrides `_streamResponseChunks`, the helper synthesizes
 *   protocol lifecycle events from those chunks
 * - otherwise it emits a one-shot start/finish lifecycle from `_generate`
 */
export async function* streamResponseEvents<
  CallOptions extends BaseChatModelCallOptions,
>(
  model: Streamv2ModelLike<CallOptions>,
  messages: BaseMessage[],
  options: CallOptions,
  runManager: CallbackManagerForLLMRun | undefined,
  hasStreamingImplementation: boolean
): AsyncGenerator<ChatModelStreamv2Event> {
  if (!model.disableStreaming && hasStreamingImplementation) {
    let finalChunk: ChatGenerationChunk | undefined;
    let messageStarted = false;
    const startedBlockIndices = new Set<number>();

    /**
     * First emit incremental lifecycle events for each streamed chunk.
     * The final aggregated chunk is saved so we can emit canonical finish events
     * with fully materialized content blocks at the end of the stream.
     */
    for await (const chunk of model._streamResponseChunks(
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

    /**
     * Finish events are emitted from the aggregated final chunk so consumers see
     * the fully reconstructed block payloads, including parsed tool-call args.
     */
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

  /**
   * Non-streaming models still get a well-formed lifecycle.
   * This keeps streamv2 additive even for models that only implement `_generate`.
   */
  const result = await model._generate(messages, options, runManager);
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

/**
 * Shared implementation for `_streamv2Iterator`.
 *
 * This helper mirrors the existing `_streamIterator` setup: it starts a chat
 * model run, streams protocol events, reconstructs the final message, and then
 * closes the callback lifecycle with the aggregated output.
 */
export async function* streamv2Iterator<
  CallOptions extends BaseChatModelCallOptions,
>(
  model: Streamv2ModelLike<CallOptions>,
  input: BaseLanguageModelInput,
  options: Partial<CallOptions> | undefined,
  formatForTracing: Streamv2TraceFormatter
): AsyncGenerator<ChatModelStreamv2Event> {
  /**
   * The public `streamv2()` method converts the incoming model input into chat
   * messages before delegating here, so this helper can work directly on that
   * normalized representation.
   */
  const messages = input as unknown as BaseMessage[];
  const [runnableConfig, callOptions] =
    model._separateRunnableConfigFromCallOptionsCompat(options);

  const inheritableMetadata = {
    ...runnableConfig.metadata,
    ...model.getLsParamsWithDefaults(callOptions),
  };
  const callbackManager_ = await CallbackManager.configure(
    runnableConfig.callbacks,
    model.callbacks,
    runnableConfig.tags,
    model.tags,
    inheritableMetadata,
    model.metadata,
    { verbose: model.verbose }
  );
  const extra = {
    options: callOptions,
    invocation_params: model?.invocationParams(callOptions),
    batch_size: 1,
  };
  const runManagers = await callbackManager_?.handleChatModelStart(
    model.toJSON(),
    [formatForTracing(messages)],
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
    for await (const event of model._streamResponseEvents(
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
      (runManagers ?? []).map((runManager) => runManager?.handleLLMError(err))
    );
    throw err;
  }

  /**
   * The event stream itself is the source of truth for the final callback
   * payload. Rebuild the terminal message from the accumulated event state.
   */
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
        generations: [
          [{ text: finalMessage.text, message: finalMessage } as ChatGeneration],
        ],
        llmOutput,
      })
    )
  );
}

/**
 * Creates the public `streamv2()` readable stream for chat models.
 */
export async function createStreamv2<
  CallOptions extends BaseChatModelCallOptions,
>(
  model: Streamv2ModelLike<CallOptions>,
  input: BaseLanguageModelInput,
  options: Partial<CallOptions> | undefined,
  formatForTracing: Streamv2TraceFormatter
): Promise<ChatModelStreamv2> {
  const config = ensureConfig(options);
  const wrappedGenerator = new AsyncGeneratorWithSetup({
    generator: streamv2Iterator(model, input, config as Partial<CallOptions>, formatForTracing),
    config,
  });
  await wrappedGenerator.setup;
  return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
}
