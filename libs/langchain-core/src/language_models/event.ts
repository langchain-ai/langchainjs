/**
 * Chat model streaming event protocol.
 *
 * Defines a content-block-centric event model for streaming chat model responses.
 * Events carry LangChain {@link ContentBlock} types directly as accumulated
 * snapshots.
 *
 * ## Design Principles
 *
 * 1. **Content blocks are the universal carrier.** Events carry {@link ContentBlock}
 *    instances directly — the block's `type` field is the discriminant. New content
 *    block types automatically work without protocol changes.
 *
 * 2. **Lifecycle completeness.** Every streamable entity has explicit start and finish
 *    events. Consumers never need to infer boundaries from absence of events.
 *
 * 3. **Accumulated snapshots.** Each {@link ContentBlockDeltaEvent} carries the
 *    accumulated state of the content block so far. Aggregation logic lives in the
 *    provider adapter, not the consumer. Consumers who need incremental deltas
 *    track previous state and diff.
 *
 * 4. **Interleaving allowed.** Content blocks may interleave (e.g., parallel tool calls).
 *    The only invariant: a block's start precedes its deltas, and its deltas precede
 *    its finish. No ordering constraint between different blocks.
 *
 * 5. **Provider passthrough.** Native provider events that don't map to standard types
 *    are forwarded as {@link ProviderEvent} rather than silently dropped.
 *
 * ## Lifecycle Contract
 *
 * ```
 * MessageStart
 *   -> ContentBlockStart(index=0, ...)
 *   -> ContentBlockStart(index=1, ...)        // can start before 0 finishes
 *   -> ContentBlockDelta(index=0, ...)
 *   -> ContentBlockDelta(index=1, ...)        // interleaved
 *   -> ContentBlockFinish(index=0, ...)       // blocks finish independently
 *   -> ContentBlockDelta(index=1, ...)
 *   -> ContentBlockFinish(index=1, ...)
 *   -> UsageUpdate(...)                       // may appear at any point
 * -> MessageFinish(reason, usage?)
 * ```
 *
 * @module
 */

import type {
  ContentBlock,
  PartialContentBlock,
} from "../messages/content/index.js";
import type { UsageMetadata } from "../messages/metadata.js";

/**
 * Emitted once at the start of a model response.
 */
export interface MessageStartEvent {
  type: "message-start";
  /** Optional message ID assigned by the provider. */
  id?: string;
  /**
   * Initial usage snapshot, if the provider reports input token counts
   * before content begins streaming (e.g., Anthropic's `message_start`).
   */
  usage?: UsageMetadata;
}

/**
 * Finish reason for a model response.
 *
 * - `"stop"`: Natural end of generation.
 * - `"length"`: Hit max token limit.
 * - `"tool_use"`: Model is requesting tool execution.
 * - `"content_filter"`: Content was filtered by safety systems.
 */
export type FinishReason = "stop" | "length" | "tool_use" | "content_filter";

/**
 * Emitted once when the model response is complete.
 */
export interface MessageFinishEvent {
  type: "message-finish";
  /** Why the model stopped generating. */
  reason: FinishReason;
  /** Final usage snapshot. */
  usage?: UsageMetadata;
  /** Provider-specific response metadata (model name, response ID, headers, etc.). */
  responseMetadata?: Record<string, unknown>;
}

/**
 * Emitted when a new content block begins streaming.
 *
 * @example
 * ```ts
 * // Text block starting
 * { type: "content-block-start", index: 0,
 *   content: { type: "text", text: "" } }
 *
 * // Tool call starting
 * { type: "content-block-start", index: 1,
 *   content: { type: "tool_call", id: "call_1", name: "search", args: "" } }
 *
 * // Reasoning starting
 * { type: "content-block-start", index: 2,
 *   content: { type: "reasoning", reasoning: "" } }
 * ```
 */
export interface ContentBlockStartEvent {
  type: "content-block-start";
  /** Positional index of this block within the message. */
  index: number;
  /** Initial state of the content block. */
  content: ContentBlock;
}

/**
 * Emitted for each incremental update within a content block.
 *
 * Carries the **accumulated state** of the content block so far.
 * The content is deeply partial — not all fields may be populated during
 * streaming (e.g., a tool call may have `name` but `args` is still being
 * streamed as a partial JSON string).
 *
 * Consumers who need incremental deltas (e.g., new tokens only) should
 * track the previous state and diff against the new accumulated state.
 *
 * Aggregation into `AIMessage` is trivial:
 * `message.content[event.index] = event.content`
 *
 * @example
 * ```ts
 * // First text delta — accumulated so far
 * { type: "content-block-delta", index: 0,
 *   content: { type: "text", text: "Hello" } }
 *
 * // Second text delta — accumulated so far
 * { type: "content-block-delta", index: 0,
 *   content: { type: "text", text: "Hello world" } }
 *
 * // Tool call args — accumulated so far
 * { type: "content-block-delta", index: 1,
 *   content: { type: "tool_call", id: "call_1", name: "search", args: '{"q":"wea' } }
 * ```
 */
export interface ContentBlockDeltaEvent {
  type: "content-block-delta";
  /** Positional index of the block being updated. */
  index: number;
  /** Accumulated state of the content block after this update. Deeply partial. */
  content: PartialContentBlock;
}

/**
 * Emitted when a content block is complete.
 *
 * The `content` carries the **finalized** block. For tool calls, this means
 * args have been parsed from a JSON string into an object.
 *
 * @example
 * ```ts
 * // Finalized text block
 * { type: "content-block-finish", index: 0,
 *   content: { type: "text", text: "The weather is sunny." } }
 *
 * // Finalized tool call (args parsed)
 * { type: "content-block-finish", index: 1,
 *   content: { type: "tool_call", id: "call_1", name: "search",
 *              args: { q: "weather" } } }
 * ```
 */
export interface ContentBlockFinishEvent {
  type: "content-block-finish";
  /** Positional index of the completed block. */
  index: number;
  /** Finalized content block. */
  content: ContentBlock;
}

/**
 * Emitted whenever the provider reports updated usage information.
 *
 * May appear at any point during streaming. Each event carries a
 * **running snapshot** of usage (not an additive delta), so consumers
 * can simply take the latest value.
 *
 * @example
 * ```ts
 * // After message_start (Anthropic: input tokens known)
 * { type: "usage", usage: { input_tokens: 1234, output_tokens: 0, total_tokens: 1234 } }
 *
 * // After streaming completes
 * { type: "usage", usage: { input_tokens: 1234, output_tokens: 567, total_tokens: 1801 } }
 * ```
 */
export interface UsageUpdateEvent {
  type: "usage";
  /** Current usage snapshot. */
  usage: UsageMetadata;
}

/**
 * Passthrough for native provider events that don't map to standard types.
 *
 * Provider adapters map recognized events to standard {@link ChatModelStreamEvent}
 * types and forward everything else as `ProviderEvent`. This ensures no information
 * is silently dropped.
 *
 * @example
 * ```ts
 * // OpenAI server-side web search in progress
 * { type: "provider", provider: "openai",
 *   name: "response.web_search_call.searching",
 *   payload: { item_id: "ws_123", output_index: 0 } }
 *
 * // Anthropic context management signal
 * { type: "provider", provider: "anthropic",
 *   name: "context_management",
 *   payload: { ... } }
 * ```
 */
export interface ProviderEvent {
  type: "provider";
  /** Provider identifier (e.g., `"openai"`, `"anthropic"`, `"google"`). */
  provider: string;
  /** Raw event type name from the provider SDK. */
  name: string;
  /** Raw event payload from the provider SDK. */
  payload: unknown;
}

/**
 * Emitted on unrecoverable stream errors.
 */
export interface StreamErrorEvent {
  type: "error";
  /** Human-readable error message. */
  message: string;
  /** Optional error code for programmatic handling. */
  code?: string;
}

/**
 * Union of all chat model stream event types.
 *
 * This is the type yielded by `ChatModelStream[Symbol.asyncIterator]()`.
 */
export type ChatModelStreamEvent =
  | MessageStartEvent
  | MessageFinishEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockFinishEvent
  | UsageUpdateEvent
  | ProviderEvent
  | StreamErrorEvent;
