/**
 * Chat model streaming event protocol.
 *
 * Defines a content-block-centric event model for streaming chat model responses.
 * Events carry LangChain {@link ContentBlock} types on lifecycle boundaries
 * (start/finish) and typed incremental deltas during streaming.
 *
 * ## Design Principles
 *
 * 1. **Typed deltas for common cases.** Text, reasoning, and tool call argument
 *    streaming get purpose-built delta types with explicit append semantics.
 *    Everything else uses `block-delta` with overwrite semantics.
 *
 * 2. **Lifecycle completeness.** Every streamable entity has explicit start and finish
 *    events. Consumers never need to infer boundaries from absence of events.
 *
 * 3. **Interleaving allowed.** Content blocks may interleave (e.g., parallel tool calls).
 *    The only invariant: a block's start precedes its deltas, and its deltas precede
 *    its finish. No ordering constraint between different blocks.
 *
 * 4. **Provider passthrough.** Native provider events that don't map to standard types
 *    are forwarded as {@link ProviderEvent} rather than silently dropped.
 *
 * ## Lifecycle Contract
 *
 * ```
 * MessageStart
 *   -> ContentBlockStart(index=0, content=...)
 *   -> ContentBlockDelta(index=0, delta={ type: "text-delta", text: "Hello" })
 *   -> ContentBlockDelta(index=0, delta={ type: "text-delta", text: " world" })
 *   -> ContentBlockFinish(index=0, content=...)
 *   -> UsageUpdate(...)
 * -> MessageFinish(reason, usage?)
 * ```
 *
 * @module
 */

import type { ContentBlock } from "../messages/content/index.js";
import type { PartialContentBlock } from "../messages/content/index.js";
import type { UsageMetadata } from "../messages/metadata.js";

// ─── Content Block Deltas ───────────────────────────────────────

/**
 * Incremental text content. **Append** `text` to the block's `text` field.
 */
export interface TextDelta {
  type: "text-delta";
  /** The new text to append. */
  text: string;
}

/**
 * Incremental reasoning content. **Append** `reasoning` to the block's `reasoning` field.
 */
export interface ReasoningDelta {
  type: "reasoning-delta";
  /** The new reasoning text to append. */
  reasoning: string;
}

/**
 * Incremental tool call data. **Append** `args` to the block's `args` field.
 * `id` and `name` are set (not appended) if present.
 */
export interface ToolCallDelta {
  type: "tool-call-delta";
  /** Tool call identifier. Set on first delta, not appended. */
  id?: string;
  /** Tool name. Set on first delta, not appended. */
  name?: string;
  /** Partial JSON arguments string to append. */
  args?: string;
}

/**
 * Catch-all delta for content block types without a dedicated delta type.
 * **Overwrite** fields from `content` onto the accumulated block.
 *
 * Used for provider-specific block types like code interpreter output,
 * signatures, citations, compaction, etc.
 */
export interface BlockDelta {
  type: "block-delta";
  /** Partial content block whose fields overwrite the accumulated block. */
  content: PartialContentBlock;
}

/**
 * Union of all content block delta types.
 *
 * Accumulation rules:
 * - `text-delta` → **append** `text` to block's text field
 * - `reasoning-delta` → **append** `reasoning` to block's reasoning field
 * - `tool-call-delta` → **append** `args`, **set** id/name if present
 * - `block-delta` → **overwrite** fields from content onto block
 */
export type ContentBlockDelta =
  | TextDelta
  | ReasoningDelta
  | ToolCallDelta
  | BlockDelta;

// ─── Message Lifecycle ──────────────────────────────────────────

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

// ─── Content Block Lifecycle ────────────────────────────────────

/**
 * Emitted when a new content block begins streaming.
 *
 * @example
 * ```ts
 * { type: "content-block-start", index: 0,
 *   content: { type: "text", text: "" } }
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
 * The `delta` field carries a typed incremental update. Consumers
 * switch on `delta.type` to determine how to apply it.
 *
 * @example
 * ```ts
 * // Text token
 * { type: "content-block-delta", index: 0,
 *   delta: { type: "text-delta", text: " world" } }
 *
 * // Tool call args chunk
 * { type: "content-block-delta", index: 1,
 *   delta: { type: "tool-call-delta", args: '{"q":"wea' } }
 *
 * // Provider-specific field (e.g., signature)
 * { type: "content-block-delta", index: 0,
 *   delta: { type: "block-delta", content: { type: "reasoning", signature: "sig_abc" } } }
 * ```
 */
export interface ContentBlockDeltaEvent {
  type: "content-block-delta";
  /** Positional index of the block being updated. */
  index: number;
  /** Typed incremental delta. */
  delta: ContentBlockDelta;
}

/**
 * Emitted when a content block is complete.
 *
 * @example
 * ```ts
 * { type: "content-block-finish", index: 0,
 *   content: { type: "text", text: "Hello world" } }
 * ```
 */
export interface ContentBlockFinishEvent {
  type: "content-block-finish";
  /** Positional index of the completed block. */
  index: number;
  /** Finalized content block. */
  content: ContentBlock;
}

// ─── Usage ──────────────────────────────────────────────────────

/**
 * Emitted whenever the provider reports updated usage information.
 * Each event carries a **running snapshot** (not an additive delta).
 */
export interface UsageUpdateEvent {
  type: "usage";
  /** Current usage snapshot. */
  usage: UsageMetadata;
}

// ─── Provider Passthrough ───────────────────────────────────────

/**
 * Passthrough for native provider events that don't map to standard types.
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

// ─── Error ──────────────────────────────────────────────────────

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

// ─── Union ──────────────────────────────────────────────────────

/**
 * Union of all chat model stream event types.
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
