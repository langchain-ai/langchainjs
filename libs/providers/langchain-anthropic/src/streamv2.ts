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
import type {
  AnthropicMessageCreateParams,
  AnthropicMessageStreamEvent,
  AnthropicRequestOptions,
  AnthropicStreamingMessageCreateParams,
  Kwargs,
} from "./types.js";

/**
 * Inputs for {@link streamAnthropicResponseEvents}, supplied by `ChatAnthropic`
 * so streaming logic stays testable without duplicating `invocationParams` and
 * message-formatting wiring.
 */
export type StreamAnthropicResponseEventsInput<
  CallOptions extends BaseChatModelCallOptions,
> = {
  messages: BaseMessage[];
  options: CallOptions;
  runManager?: CallbackManagerForLLMRun;
  invocationParams: Record<string, unknown>;
  streamUsage?: boolean;
  convertMessagesToPayload: typeof _convertMessagesToAnthropicPayload;
  applyCacheControlToPayload: typeof applyCacheControlToPayload;
  toolsInParams: (
    params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
  ) => boolean;
  documentsInParams: (
    params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
  ) => boolean;
  thinkingInParams: (
    params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
  ) => boolean;
  compactionInParams: (
    params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
  ) => boolean;
  createStreamWithRetry: (
    request: AnthropicStreamingMessageCreateParams & Kwargs,
    options?: AnthropicRequestOptions
  ) => Promise<AsyncIterable<unknown> & { controller?: { abort(): void } }>;
  makeMessageChunkFromAnthropicEvent: typeof _makeMessageChunkFromAnthropicEvent;
  extractToken: (chunk: AIMessageChunk) => string | undefined;
};

/**
 * Shallow-remove keys whose value is `undefined` so emitted protocol blocks are
 * clean for logging and JSON serialization.
 */
export function omitUndefinedContentBlockValues<
  T extends Record<string, unknown>,
>(block: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

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
 * Must match `STREAMV2_INCREMENTAL_CONTENT_BLOCK_STRING_KEYS` in
 * `langchain-core` `language_models/streamv2.ts` (duplicated here to avoid
 * import cycles with `language_models/chat_models`).
 */
const STREAMV2_INCREMENTAL_CONTENT_BLOCK_STRING_KEYS = new Set([
  "text",
  "reasoning",
  "args",
]);

/**
 * Merge a protocol delta into the current Anthropic block state.
 *
 * String fields are appended so text and partial JSON accumulate over time,
 * while object payloads are shallow-merged to preserve provider metadata.
 */
/**
 * Skip translated blocks that duplicate server-hosted tool streaming: Anthropic
 * emits both `server_tool_use` (mapped to `server_tool_call`) and
 * `input_json_delta` (mapped to `tool_call_chunk`) for the same index.
 * Streamv2 keeps a single `server_tool_call_chunk` line fed by `partial_json`.
 */
export function shouldSkipAnthropicStreamv2ProtocolBlock(
  block: ProtocolContentBlock,
  index: number,
  serverToolIndices: ReadonlySet<number>,
  blockStates: ReadonlyMap<number, ProtocolContentBlock>
): boolean {
  if (block.type === "tool_call_chunk" && serverToolIndices.has(index)) {
    return true;
  }
  if (
    block.type === "server_tool_call" &&
    serverToolIndices.has(index) &&
    blockStates.has(index)
  ) {
    return true;
  }
  return false;
}

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
      if (STREAMV2_INCREMENTAL_CONTENT_BLOCK_STRING_KEYS.has(key)) {
        nextBlock[key] = existingValue + value;
      } else {
        nextBlock[key] = value;
      }
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
  input: StreamAnthropicResponseEventsInput<CallOptions>
): AsyncGenerator<ChatModelStreamv2Event> {
  const {
    messages,
    options,
    runManager,
    invocationParams: params,
    streamUsage,
    convertMessagesToPayload,
    applyCacheControlToPayload: applyCache,
    toolsInParams,
    documentsInParams,
    thinkingInParams,
    compactionInParams,
    createStreamWithRetry,
    makeMessageChunkFromAnthropicEvent,
    extractToken,
  } = input;

  let formattedMessages = convertMessagesToPayload(messages);

  if ("cache_control" in options && options.cache_control) {
    formattedMessages = applyCache(
      formattedMessages,
      options.cache_control as Parameters<typeof applyCacheControlToPayload>[1]
    );
  }

  const payload = {
    ...params,
    ...formattedMessages,
    stream: true,
  } as AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams;

  const coerceContentToString =
    !toolsInParams(payload) &&
    !documentsInParams(payload) &&
    !thinkingInParams(payload) &&
    !compactionInParams(payload);

  const shouldStreamUsage: boolean | undefined =
    streamUsage ??
    ("streamUsage" in options && typeof options.streamUsage === "boolean"
      ? options.streamUsage
      : undefined);

  const stream = await createStreamWithRetry(
    payload as AnthropicStreamingMessageCreateParams & Kwargs,
    {
      headers:
        "headers" in options && options.headers !== undefined
          ? (options.headers as AnthropicRequestOptions["headers"])
          : undefined,
      signal: "signal" in options ? options.signal : undefined,
    }
  );

  const blockStates = new Map<number, ProtocolContentBlock>();
  /** Content block indices that use `server_tool_use` (hosted tools). */
  const serverToolIndices = new Set<number>();
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
    /** Align stream event unions with `_makeMessageChunkFromAnthropicEvent` (beta vs non-beta SDK variants). */
    type MakeChunkEventArg = Parameters<
      typeof _makeMessageChunkFromAnthropicEvent
    >[0];
    const dataForChunk = data as MakeChunkEventArg;

    if (
      data.type === "content_block_start" &&
      "content_block" in data &&
      data.content_block &&
      typeof data.content_block === "object" &&
      "type" in data.content_block &&
      data.content_block.type === "server_tool_use"
    ) {
      serverToolIndices.add(data.index);
    }

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
          contentBlock: omitUndefinedContentBlockValues(
            finalizeAnthropicProtocolContentBlock(blockState) as Record<
              string,
              unknown
            >
          ) as ProtocolFinalizedContentBlock,
        } satisfies ContentBlockFinishData;
      }
      continue;
    }

    if (data.type === "message_delta") {
      finishReason = getAnthropicProtocolFinishReason(data.delta.stop_reason);
      const usageChunk = makeMessageChunkFromAnthropicEvent(dataForChunk, {
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

    const result = makeMessageChunkFromAnthropicEvent(dataForChunk, {
      streamUsage: shouldStreamUsage ?? true,
      coerceContentToString,
    });
    if (!result) {
      continue;
    }

    const { chunk } = result;
    const token = extractToken(chunk);
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

    /**
     * Server-hosted tools stream arguments only via `input_json_delta`; map those
     * fragments onto `server_tool_call_chunk` so deltas stay chunk-shaped and
     * `content-block-finish` can parse a single accumulated JSON string.
     */
    if (
      data.type === "content_block_delta" &&
      data.delta &&
      typeof data.delta === "object" &&
      "type" in data.delta &&
      data.delta.type === "input_json_delta" &&
      "partial_json" in data.delta &&
      typeof data.delta.partial_json === "string" &&
      serverToolIndices.has(data.index)
    ) {
      const prior = blockStates.get(data.index);
      if (prior !== undefined && prior.type === "server_tool_call_chunk") {
        const protocolBlock: ProtocolContentBlock = {
          type: "server_tool_call_chunk",
          id: prior.id,
          name: prior.name,
          args: data.delta.partial_json,
          index: data.index,
        };
        const index = data.index;
        const currentBlock =
          blockStates.get(index) ??
          getAnthropicContentBlockStart(protocolBlock, index);

        if (!blockStates.has(index)) {
          yield {
            event: "content-block-start",
            index,
            contentBlock: omitUndefinedContentBlockValues(
              currentBlock as Record<string, unknown>
            ) as ProtocolContentBlock,
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
          contentBlock: omitUndefinedContentBlockValues({
            ...protocolBlock,
            index,
          } as Record<string, unknown>) as ProtocolContentBlock,
        };

        await runManager?.handleLLMNewToken(
          token ?? "",
          undefined,
          undefined,
          undefined,
          undefined,
          { chunk: generationChunk }
        );
        continue;
      }
    }

    for (const [
      fallbackIndex,
      block,
    ] of generationChunk.message.contentBlocks.entries()) {
      const protocolBlock = block as ProtocolContentBlock;
      const index = getAnthropicContentBlockIndex(protocolBlock, fallbackIndex);

      if (
        shouldSkipAnthropicStreamv2ProtocolBlock(
          protocolBlock,
          index,
          serverToolIndices,
          blockStates
        )
      ) {
        continue;
      }

      const currentBlock =
        blockStates.get(index) ??
        getAnthropicContentBlockStart(protocolBlock, index);

      if (!blockStates.has(index)) {
        yield {
          event: "content-block-start",
          index,
          contentBlock: omitUndefinedContentBlockValues(
            currentBlock as Record<string, unknown>
          ) as ProtocolContentBlock,
        } satisfies ContentBlockStartData;
      }

      /**
       * On `content_block_start`, the translator yields canonical `tool_call` /
       * `server_tool_call` with object args. Merging that into `*_chunk` state
       * corrupts string `args` and emits an extra delta before `input_json_delta`.
       * Keep only the normalized chunk snapshot from `getAnthropicContentBlockStart`.
       */
      if (
        data.type === "content_block_start" &&
        (protocolBlock.type === "tool_call" ||
          protocolBlock.type === "server_tool_call")
      ) {
        blockStates.set(index, currentBlock);
        continue;
      }

      const mergedBlock = mergeAnthropicProtocolContentBlock(currentBlock, {
        ...protocolBlock,
        index,
      });
      blockStates.set(index, mergedBlock);

      yield {
        event: "content-block-delta",
        index,
        contentBlock: omitUndefinedContentBlockValues({
          ...protocolBlock,
          index,
        } as Record<string, unknown>) as ProtocolContentBlock,
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
