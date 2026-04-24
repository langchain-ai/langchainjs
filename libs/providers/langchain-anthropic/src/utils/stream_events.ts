/**
 * Converts a raw Anthropic SSE event stream into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import type Anthropic from "@anthropic-ai/sdk";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock } from "@langchain/core/messages/content";
import type { UsageMetadata } from "@langchain/core/messages/metadata";
import type { AnthropicMessageStreamEvent } from "../types.js";

// ─── Public API ─────────────────────────────────────────────────

export interface ConvertAnthropicStreamOptions {
  streamUsage?: boolean;
}

/**
 * Convert an async iterable of raw Anthropic stream events into
 * LangChain `ChatModelStreamEvent`s with typed deltas.
 */
export async function* convertAnthropicStream(
  source: AsyncIterable<AnthropicMessageStreamEvent>,
  options: ConvertAnthropicStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;

  // Track accumulated state per content block (for finalization)
  const blockAccumulators = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();
  let usageSnapshot: UsageMetadata | undefined;
  let stopReason: string | null = null;

  for await (const data of source) {
    switch (data.type) {
      // ── Message lifecycle ──────────────────────────────────
      case "message_start": {
        const { usage, id, model } = data.message;
        if (usage && shouldStreamUsage) {
          usageSnapshot = buildUsageSnapshot(usage);
        }
        yield {
          type: "message-start" as const,
          id,
          ...(usageSnapshot ? { usage: usageSnapshot } : {}),
        };
        yield {
          type: "provider" as const,
          provider: "anthropic",
          name: "message_start",
          payload: { model, id },
        };
        break;
      }

      case "message_delta": {
        stopReason = data.delta.stop_reason;
        if (shouldStreamUsage && data.usage) {
          if (!usageSnapshot) {
            usageSnapshot = {
              input_tokens: 0,
              output_tokens: data.usage.output_tokens,
              total_tokens: data.usage.output_tokens,
            };
          } else {
            usageSnapshot = {
              ...usageSnapshot,
              output_tokens:
                usageSnapshot.output_tokens + data.usage.output_tokens,
              total_tokens:
                usageSnapshot.input_tokens +
                usageSnapshot.output_tokens +
                data.usage.output_tokens,
            };
          }
          yield { type: "usage" as const, usage: usageSnapshot };
        }
        if (
          "context_management" in data.delta &&
          data.delta.context_management
        ) {
          yield {
            type: "provider" as const,
            provider: "anthropic",
            name: "context_management",
            payload: data.delta.context_management,
          };
        }
        break;
      }

      case "message_stop": {
        yield {
          type: "message-finish" as const,
          reason: mapStopReason(stopReason),
          ...(usageSnapshot ? { usage: usageSnapshot } : {}),
          responseMetadata: { model_provider: "anthropic" },
        };
        break;
      }

      // ── Content block lifecycle ───────────────────────────
      case "content_block_start": {
        const { index, content_block } = data;
        const mapped = mapBlockToContentBlock(content_block, index);
        blockAccumulators.set(index, { ...mapped });
        yield {
          type: "content-block-start" as const,
          index,
          content: mapped,
        };
        break;
      }

      case "content_block_delta": {
        const { index, delta } = data;
        const acc = blockAccumulators.get(index);
        if (!acc) break;

        const { contentDelta, accumulated } = applyAnthropicDelta(acc, delta);
        blockAccumulators.set(index, accumulated);

        yield {
          type: "content-block-delta" as const,
          index,
          content: contentDelta,
        };
        break;
      }

      case "content_block_stop": {
        const { index } = data;
        const acc = blockAccumulators.get(index);
        if (!acc) break;

        const finalized = finalizeBlock(acc);
        yield {
          type: "content-block-finish" as const,
          index,
          content: finalized,
        };
        blockAccumulators.delete(index);
        break;
      }

      // ── Unhandled → provider passthrough ───────────────────
      default: {
        yield {
          type: "provider" as const,
          provider: "anthropic",
          name: data.type,
          payload: data,
        };
        break;
      }
    }
  }
}

// ─── Internal helpers ───────────────────────────────────────────

function mapStopReason(stopReason: string | null | undefined): FinishReason {
  switch (stopReason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "length";
    default:
      return "stop";
  }
}

function buildUsageSnapshot(
  usage: Anthropic.Messages.Usage | Record<string, number>
): UsageMetadata {
  const cacheCreation =
    (usage as Record<string, number>).cache_creation_input_tokens ?? 0;
  const cacheRead =
    (usage as Record<string, number>).cache_read_input_tokens ?? 0;
  const totalInput = usage.input_tokens + cacheCreation + cacheRead;
  return {
    input_tokens: totalInput,
    output_tokens: usage.output_tokens,
    total_tokens: totalInput + usage.output_tokens,
    input_token_details: {
      cache_creation: cacheCreation,
      cache_read: cacheRead,
    },
  };
}

function mapBlockToContentBlock(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  block: any,
  index: number
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  switch (block.type) {
    case "text":
      return { type: "text" as const, text: block.text ?? "", index };
    case "thinking":
      return {
        type: "reasoning" as const,
        reasoning: block.thinking ?? "",
        index,
      };
    case "redacted_thinking":
      return { type: "non_standard" as const, value: { ...block }, index };
    case "tool_use":
      return {
        type: "tool_call_chunk" as const,
        id: block.id,
        name: block.name,
        args: "",
        index,
      };
    case "server_tool_use":
      return {
        type: "server_tool_call_chunk" as const,
        id: block.id,
        name: block.name,
        args: "",
        index,
      };
    default:
      return { type: "non_standard" as const, value: { ...block }, index };
  }
}

/**
 * Map an Anthropic content_block_delta to a content block update
 * and update the accumulated state.
 */
function applyAnthropicDelta(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  accumulated: Record<string, any>,
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  delta: any
): {
  contentDelta: ContentBlock;
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  accumulated: Record<string, any>;
} {
  switch (delta.type) {
    case "text_delta":
      return {
        contentDelta: { type: "text" as const, text: delta.text },
        accumulated: {
          ...accumulated,
          text: (accumulated.text ?? "") + delta.text,
        },
      };

    case "thinking_delta":
      return {
        contentDelta: {
          type: "reasoning" as const,
          reasoning: delta.thinking,
        },
        accumulated: {
          ...accumulated,
          reasoning: (accumulated.reasoning ?? "") + delta.thinking,
        },
      };

    case "input_json_delta": {
      const newArgs = (accumulated.args ?? "") + delta.partial_json;
      return {
        contentDelta: { type: accumulated.type, args: delta.partial_json },
        accumulated: { ...accumulated, args: newArgs },
      };
    }

    case "citations_delta":
      return {
        contentDelta: {
          type: accumulated.type,
          annotations: [...(accumulated.annotations ?? []), delta.citation],
        },
        accumulated: {
          ...accumulated,
          annotations: [...(accumulated.annotations ?? []), delta.citation],
        },
      };

    case "signature_delta":
      return {
        contentDelta: { type: accumulated.type, signature: delta.signature },
        accumulated: { ...accumulated, signature: delta.signature },
      };

    case "compaction_delta":
      return {
        contentDelta: { type: "non_standard", value: { compaction: delta } },
        accumulated: {
          ...accumulated,
          value: { ...(accumulated.value ?? {}), compaction: delta },
        },
      };

    default:
      return {
        contentDelta: { type: accumulated.type, ...delta },
        accumulated,
      };
  }
}

function finalizeBlock(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  accumulated: Record<string, any>
): ContentBlock {
  if (
    accumulated.type === "tool_call_chunk" ||
    accumulated.type === "server_tool_call_chunk"
  ) {
    const finalType =
      accumulated.type === "tool_call_chunk"
        ? ("tool_call" as const)
        : ("server_tool_call" as const);
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(accumulated.args || "{}");
    } catch {
      return {
        type: "invalid_tool_call" as const,
        id: accumulated.id,
        name: accumulated.name,
        args: accumulated.args,
        error: "Failed to parse tool call arguments as JSON",
      } as ContentBlock.Tools.InvalidToolCall;
    }
    return {
      type: finalType,
      id: accumulated.id,
      name: accumulated.name,
      args: parsedArgs,
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  const { index: _index, ...rest } = accumulated;
  return rest as ContentBlock;
}
