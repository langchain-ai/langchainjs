import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import type {
  BaseChatModelCallOptions,
  ChatModelStreamv2Event,
} from "@langchain/core/language_models/chat_models";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type {
  ContentBlock as ProtocolContentBlock,
  ContentBlockFinishData,
  ContentBlockStartData,
  FinalizedContentBlock as ProtocolFinalizedContentBlock,
  MessageFinishData,
  MessageStartData,
} from "@langchain/protocol";

import { _makeMessageChunkFromAnthropicEvent } from "./utils/message_outputs.js";
import {
  _convertMessagesToAnthropicPayload,
  applyCacheControlToPayload,
} from "./utils/message_inputs.js";

/**
 * Minimal shape required from Anthropic chat models to stream protocol-native
 * events while keeping the class file focused on high-level model concerns.
 */
export type AnthropicStreamv2ModelLike<
  CallOptions extends BaseChatModelCallOptions,
> = {
  invocationParams(options?: CallOptions): Record<string, unknown>;
  streamUsage?: boolean;
  createStreamWithRetry(
    request: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<AsyncIterable<unknown> & { controller?: { abort(): void } }>;
};

/**
 * Extract a printable token from a streamed Anthropic chunk so callback handlers
 * continue to receive the same token notifications as the legacy chunk stream.
 */
export function extractAnthropicToken(
  chunk: AIMessageChunk
): string | undefined {
  if (typeof chunk.content === "string") {
    return chunk.content;
  }

  if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "input" in chunk.content[0]
  ) {
    return typeof chunk.content[0].input === "string"
      ? chunk.content[0].input
      : JSON.stringify(chunk.content[0].input);
  }

  if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "text" in chunk.content[0] &&
    typeof chunk.content[0].text === "string"
  ) {
    return chunk.content[0].text;
  }

  return undefined;
}

/**
 * Map provider stop reasons into the protocol finish-reason enum.
 */
export function getAnthropicProtocolFinishReason(
  reason: unknown
): MessageFinishData["reason"] {
  switch (reason) {
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_use";
    case "content_filter":
      return "content_filter";
    case "end_turn":
    case "stop_sequence":
    case "stop":
    default:
      return "stop";
  }
}

/**
 * Convert LangChain usage metadata into the protocol usage payload.
 */
export function getAnthropicProtocolUsage(
  usage: AIMessageChunk["usage_metadata"]
): MessageFinishData["usage"] {
  if (usage === undefined) {
    return undefined;
  }

  const cachedTokens =
    (usage.input_token_details?.cache_creation ?? 0) +
    (usage.input_token_details?.cache_read ?? 0);

  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
    cachedTokens: cachedTokens > 0 ? cachedTokens : undefined,
  };
}

/**
 * Resolve a stable protocol block index, preferring the provider-supplied value
 * when present and otherwise falling back to the current iteration index.
 */
export function getAnthropicContentBlockIndex(
  block: { index?: string | number },
  fallbackIndex: number
) {
  if (typeof block.index === "number" && Number.isFinite(block.index)) {
    return block.index;
  }

  if (typeof block.index === "string") {
    const parsedIndex = Number(block.index);
    if (Number.isFinite(parsedIndex)) {
      return parsedIndex;
    }
  }

  return fallbackIndex;
}

/**
 * Create the protocol start payload for a streamed Anthropic content block.
 *
 * Tool-call and server-tool blocks are normalized into their chunk variants so
 * subsequent deltas can accumulate into the same logical block.
 */
export function getAnthropicContentBlockStart(
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
      };
    case "server_tool_call_chunk":
      return {
        ...block,
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
 * Merge a protocol delta into the current Anthropic block state.
 *
 * String fields are appended so text and partial JSON accumulate over time,
 * while object payloads are shallow-merged to preserve provider metadata.
 */
export function mergeAnthropicProtocolContentBlock(
  current: ProtocolContentBlock,
  delta: ProtocolContentBlock
): ProtocolContentBlock {
  const nextBlock = { ...current } as Record<string, unknown>;

  for (const [key, value] of Object.entries(delta as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }

    const existingValue = nextBlock[key];
    if (existingValue === undefined) {
      nextBlock[key] = value;
    } else if (typeof existingValue === "string" && typeof value === "string") {
      nextBlock[key] = existingValue + value;
    } else if (
      typeof existingValue === "object" &&
      existingValue !== null &&
      typeof value === "object" &&
      value !== null
    ) {
      nextBlock[key] = {
        ...(existingValue as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else {
      nextBlock[key] = value;
    }
  }

  return nextBlock as ProtocolContentBlock;
}

/**
 * Finalize an Anthropic block for protocol `content-block-finish` delivery.
 *
 * Chunk tool-call blocks are upgraded into parsed tool-call objects so
 * consumers that only care about finalized values can subscribe to finish
 * events without reassembling partial JSON themselves.
 */
export function finalizeAnthropicProtocolContentBlock(
  block: ProtocolContentBlock
): ProtocolFinalizedContentBlock {
  if (block.type === "tool_call_chunk") {
    return {
      type: "tool_call",
      id: block.id ?? "",
      name: block.name ?? "",
      args: block.args && block.args.length > 0 ? JSON.parse(block.args) : {},
    };
  }

  if (block.type === "server_tool_call_chunk") {
    return {
      type: "server_tool_call",
      id: block.id ?? "",
      name: block.name ?? "",
      args: block.args && block.args.length > 0 ? JSON.parse(block.args) : {},
    };
  }

  return block as ProtocolFinalizedContentBlock;
}

/**
 * Stream Anthropic protocol-native chat model events.
 *
 * This adapter stays close to the provider event stream:
 * - `message_start` becomes protocol `message-start`
 * - content-block start/delta/stop events become explicit lifecycle events
 * - `message_delta` contributes finish metadata and usage
 *
 * Keeping this logic outside the model class makes the provider integration
 * easier to scan and gives future contributors one place to reason about the
 * mapping between Anthropic streaming events and protocol lifecycle events.
 */
export async function* streamAnthropicResponseEvents<
  CallOptions extends BaseChatModelCallOptions,
>(
  model: AnthropicStreamv2ModelLike<CallOptions>,
  messages: BaseMessage[],
  options: CallOptions,
  runManager?: CallbackManagerForLLMRun
): AsyncGenerator<ChatModelStreamv2Event> {
  const params = model.invocationParams(options);
  let formattedMessages = _convertMessagesToAnthropicPayload(messages);

  if ("cache_control" in options && options.cache_control) {
    formattedMessages = applyCacheControlToPayload(
      formattedMessages,
      options.cache_control
    );
  }

  const payload = {
    ...params,
    ...formattedMessages,
    stream: true,
  } as const;

  const coerceContentToString =
    !("tools" in payload && Array.isArray(payload.tools) && payload.tools.length > 0) &&
    !formattedMessages.messages.some((message) =>
      Array.isArray(message.content)
        ? message.content.some(
            (block) =>
              typeof block === "object" &&
              block !== null &&
              "type" in block &&
              block.type === "document" &&
              typeof block.citations === "object" &&
              block.citations?.enabled
          )
        : false
    ) &&
    !(payload.thinking &&
      typeof payload.thinking === "object" &&
      "type" in payload.thinking &&
      (payload.thinking.type === "enabled" ||
        payload.thinking.type === "adaptive")) &&
    !(
      "context_management" in payload &&
      payload.context_management &&
      typeof payload.context_management === "object" &&
      Array.isArray(payload.context_management.edits) &&
      payload.context_management.edits.some(
        (edit) =>
          typeof edit === "object" &&
          edit !== null &&
          "type" in edit &&
          edit.type === "compact_20260112"
      )
    );

  const shouldStreamUsage =
    model.streamUsage ?? ("streamUsage" in options ? options.streamUsage : undefined);

  const stream = await model.createStreamWithRetry(payload, {
    headers: "headers" in options ? options.headers : undefined,
    signal: "signal" in options ? options.signal : undefined,
  });

  const blockStates = new Map<number, ProtocolContentBlock>();
  let finishReason: MessageFinishData["reason"] = "stop";
  let finishUsage: MessageFinishData["usage"];
  let finishMetadata: Record<string, unknown> = {
    model_provider: "anthropic",
  };

  for await (const rawEvent of stream) {
    if ("signal" in options && options.signal?.aborted) {
      stream.controller?.abort();
      return;
    }

    const data = rawEvent as AnthropicMessageStreamEvent;

    if (data.type === "message_start") {
      yield {
        event: "message-start",
        messageId: data.message.id,
        metadata: {
          model_provider: "anthropic",
          id: data.message.id,
          type: data.message.type,
          role: data.message.role,
          model: data.message.model,
          stop_reason: data.message.stop_reason,
          stop_sequence: data.message.stop_sequence,
        },
      } satisfies MessageStartData;
      continue;
    }

    if (data.type === "content_block_stop") {
      const blockState = blockStates.get(data.index);
      if (blockState !== undefined) {
        yield {
          event: "content-block-finish",
          index: data.index,
          contentBlock: finalizeAnthropicProtocolContentBlock(blockState),
        } satisfies ContentBlockFinishData;
      }
      continue;
    }

    if (data.type === "message_delta") {
      finishReason = getAnthropicProtocolFinishReason(data.delta.stop_reason);
      const usageChunk = _makeMessageChunkFromAnthropicEvent(data, {
        streamUsage: shouldStreamUsage ?? true,
        coerceContentToString,
      });
      finishUsage = getAnthropicProtocolUsage(usageChunk?.chunk.usage_metadata);
      finishMetadata = {
        ...finishMetadata,
        ...(usageChunk?.chunk.response_metadata ?? {}),
      };
      continue;
    }

    const result = _makeMessageChunkFromAnthropicEvent(data, {
      streamUsage: shouldStreamUsage ?? true,
      coerceContentToString,
    });
    if (!result) {
      continue;
    }

    const { chunk } = result;
    const token = extractAnthropicToken(chunk);
    const generationChunk = new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: chunk.content,
        additional_kwargs: chunk.additional_kwargs,
        tool_call_chunks: chunk.tool_call_chunks,
        usage_metadata: shouldStreamUsage ? chunk.usage_metadata : undefined,
        response_metadata: chunk.response_metadata,
        id: chunk.id,
      }),
      text: token ?? "",
    });

    for (const [fallbackIndex, block] of generationChunk.message.contentBlocks.entries()) {
      const protocolBlock = block as ProtocolContentBlock;
      const index = getAnthropicContentBlockIndex(protocolBlock, fallbackIndex);
      const currentBlock =
        blockStates.get(index) ?? getAnthropicContentBlockStart(protocolBlock, index);

      if (!blockStates.has(index)) {
        yield {
          event: "content-block-start",
          index,
          contentBlock: currentBlock,
        } satisfies ContentBlockStartData;
      }

      const mergedBlock = mergeAnthropicProtocolContentBlock(currentBlock, {
        ...protocolBlock,
        index,
      });
      blockStates.set(index, mergedBlock);

      yield {
        event: "content-block-delta",
        index,
        contentBlock: {
          ...protocolBlock,
          index,
        },
      };
    }

    await runManager?.handleLLMNewToken(
      token ?? "",
      undefined,
      undefined,
      undefined,
      undefined,
      { chunk: generationChunk }
    );
  }

  yield {
    event: "message-finish",
    reason: finishReason,
    usage: finishUsage,
    metadata: finishMetadata,
  } satisfies MessageFinishData;
}
