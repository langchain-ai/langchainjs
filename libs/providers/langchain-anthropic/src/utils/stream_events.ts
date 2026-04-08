/**
 * Converts a raw Anthropic SSE event stream into LangChain ChatModelStreamEvents.
 *
 * This is a pure converter: it takes an async iterable of native Anthropic
 * `RawMessageStreamEvent`s and yields `ChatModelStreamEvent`s. It handles:
 *
 * - Message lifecycle (`message_start` → `message-start`, `message_stop` → `message-finish`)
 * - Content block lifecycle with fully-qualified accumulated snapshots
 * - Tool call arg accumulation and JSON parsing on finalization
 * - Usage snapshots (input tokens on start, output tokens on delta)
 * - Provider passthrough for unrecognized events
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

export interface ConvertAnthropicStreamOptions {
  /**
   * Whether to emit usage events.
   * @default true
   */
  streamUsage?: boolean;
}

/**
 * Convert an async iterable of raw Anthropic stream events into
 * LangChain `ChatModelStreamEvent`s.
 *
 * @example
 * ```ts
 * const anthropicStream = await client.messages.create({ ..., stream: true });
 * for await (const event of convertAnthropicStream(anthropicStream)) {
 *   // event is a ChatModelStreamEvent
 * }
 * ```
 */
export async function* convertAnthropicStream(
  source: AsyncIterable<AnthropicMessageStreamEvent>,
  options: ConvertAnthropicStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;

  // Track accumulated state per content block
  const blockAccumulators = new Map<
    number,
    {
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      accumulated: Record<string, any>;
      type: string;
    }
  >();
  let usageSnapshot: UsageMetadata | undefined;
  let stopReason: string | null = null;

  for await (const data of source) {
    switch (data.type) {
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
        // Emit response metadata as provider event
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
        // Forward context_management as provider event
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
        blockAccumulators.set(index, {
          accumulated: { ...mapped },
          type: mapped.type,
        });
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

        const { accumulated } = applyDelta(acc.accumulated, delta, index);
        acc.accumulated = accumulated;

        yield {
          type: "content-block-delta" as const,
          index,
          content: accumulated,
        };
        break;
      }

      case "content_block_stop": {
        const { index } = data;
        const acc = blockAccumulators.get(index);
        if (!acc) break;

        const finalized = finalizeBlock(acc.accumulated);
        yield {
          type: "content-block-finish" as const,
          index,
          content: finalized,
        };
        blockAccumulators.delete(index);
        break;
      }

      // ── Unhandled events → provider passthrough ───────────
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

/**
 * Map Anthropic's stop_reason to the standard FinishReason.
 */
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

/**
 * Build a usage snapshot from Anthropic's usage object.
 * Handles cache token details.
 */
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

/**
 * Map an Anthropic content block (from content_block_start) to a
 * LangChain ContentBlock.
 */
function mapBlockToContentBlock(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  block: any,
  index: number
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  switch (block.type) {
    case "text":
      return {
        type: "text" as const,
        text: block.text ?? "",
        index,
      };
    case "thinking":
      return {
        type: "reasoning" as const,
        reasoning: block.thinking ?? "",
        index,
      };
    case "redacted_thinking":
      return {
        type: "non_standard" as const,
        value: { ...block },
        index,
      };
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
      // document, web_search_tool_result, compaction, etc.
      return {
        type: "non_standard" as const,
        value: { ...block },
        index,
      };
  }
}

/**
 * Apply an Anthropic content_block_delta to the accumulated content block.
 * Returns both the incremental delta (as a ContentBlock) and the new
 * accumulated state.
 */
function applyDelta(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  accumulated: Record<string, any>,
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  delta: any,
  index: number
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
): { deltaBlock: Record<string, any>; accumulated: Record<string, any> } {
  switch (delta.type) {
    case "text_delta":
      return {
        deltaBlock: { type: "text" as const, text: delta.text, index },
        accumulated: {
          ...accumulated,
          text: (accumulated.text ?? "") + delta.text,
        },
      };

    case "thinking_delta":
      return {
        deltaBlock: {
          type: "reasoning" as const,
          reasoning: delta.thinking,
          index,
        },
        accumulated: {
          ...accumulated,
          reasoning: (accumulated.reasoning ?? "") + delta.thinking,
        },
      };

    case "input_json_delta":
      return {
        deltaBlock: {
          type: accumulated.type,
          args: delta.partial_json,
          index,
        },
        accumulated: {
          ...accumulated,
          args: (accumulated.args ?? "") + delta.partial_json,
        },
      };

    case "citations_delta": {
      const newCitation = delta.citation;
      const existingAnnotations = accumulated.annotations ?? [];
      return {
        deltaBlock: {
          type: "text" as const,
          text: "",
          annotations: [newCitation],
          index,
        },
        accumulated: {
          ...accumulated,
          annotations: [...existingAnnotations, newCitation],
        },
      };
    }

    case "signature_delta":
      return {
        deltaBlock: {
          type: "non_standard" as const,
          value: { signature: delta.signature },
          index,
        },
        accumulated: {
          ...accumulated,
          signature: delta.signature,
        },
      };

    case "compaction_delta":
      return {
        deltaBlock: {
          type: "non_standard" as const,
          value: { compaction: delta },
          index,
        },
        accumulated: {
          ...accumulated,
          value: {
            ...(accumulated.value ?? {}),
            compaction: delta,
          },
        },
      };

    default:
      return {
        deltaBlock: {
          type: "non_standard" as const,
          value: delta,
          index,
        },
        accumulated,
      };
  }
}

/**
 * Finalize an accumulated content block for the content-block-finish event.
 * For tool calls, parse the accumulated JSON args string.
 */
function finalizeBlock(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  accumulated: Record<string, any>
): ContentBlock.Standard {
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

  // Text and reasoning blocks: strip the index for the finalized form
  const { index: _index, ...rest } = accumulated;
  return rest as ContentBlock.Standard;
}
