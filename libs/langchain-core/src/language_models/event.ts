/**
 * Chat model streaming event protocol.
 *
 * Defines a content-block-centric event model for streaming chat model responses.
 * Events carry LangChain {@link ContentBlock} types on lifecycle boundaries
 * and explicit delta variants for incremental updates during streaming.
 *
 * ## Design Principles
 *
 * 1. **Content-block deltas have explicit merge semantics.** Text,
 *    reasoning, and data deltas append to named fields. Generic block deltas
 *    shallow-merge fields onto the active content block.
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
import type { UsageMetadata } from "../messages/metadata.js";

// ─── Message Lifecycle ──────────────────────────────────────────

/**
 * Emitted once at the start of a model response.
 */
export interface MessageStartEvent {
  event: "message-start";
  /** Optional message ID assigned by the provider. */
  id?: string;
  /**
   * Initial usage snapshot, if the provider reports input token counts
   * before content begins streaming (e.g., Anthropic's `message_start`).
   */
  usage?: Partial<UsageMetadata>;
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
  event: "message-finish";
  /** Why the model stopped generating. */
  reason?: FinishReason;
  /** Final usage snapshot. */
  usage?: Partial<UsageMetadata>;
  /** Provider-specific response metadata (model name, response ID, headers, etc.). */
  metadata?: Record<string, unknown>;
}

// ─── Content Block Lifecycle ────────────────────────────────────
// See https://github.com/langchain-ai/agent-protocol/blob/main/streaming/protocol.cddl

/**
 * Emitted when a new content block begins streaming.
 *
 * @example
 * ```ts
 * { event: "content-block-start", index: 0,
 *   content: { type: "text", text: "" } }
 * ```
 */
export interface ContentBlockStartEvent {
  event: "content-block-start";
  /** Positional index of this block within the message. */
  index: number;
  /** Initial state of the content block. */
  content: ContentBlock;
}

// ─── Content Block Deltas ───────────────────────────────────────

/**
 * Incremental text content. Append `text` to the active block's `text` field.
 */
export interface TextDelta {
  type: "text-delta";
  /** The new text to append. */
  text: string;
}

/**
 * Incremental reasoning content. Append `reasoning` to the active block's
 * `reasoning` field.
 */
export interface ReasoningDelta {
  type: "reasoning-delta";
  /** The new reasoning text to append. */
  reasoning: string;
}

/**
 * Incremental encoded data. Append `data` to the active multimodal block's
 * data field.
 */
export interface DataDelta {
  type: "data-delta";
  /** Encoded data chunk to append. */
  data: string;
  /** Encoding for the data chunk. Defaults to `"base64"` when omitted. */
  encoding?: "base64";
}

/**
 * Generic content block field update. Shallow-merge `fields` onto the active
 * content block.
 */
export interface BlockDelta {
  type: "block-delta";
  /** Fields to shallow-merge onto the active content block. */
  fields: { type: string } & Record<string, unknown>;
}

/**
 * Union of all content block delta types.
 */
export type ContentBlockDelta =
  | TextDelta
  | ReasoningDelta
  | DataDelta
  | BlockDelta;

/**
 * Emitted for each incremental update within a content block.
 *
 * The `delta` field carries the incremental content block update.
 * Accumulation rules:
 * - `text-delta` → append `text` to the active block's text field
 * - `reasoning-delta` → append `reasoning` to the active block's reasoning field
 * - `data-delta` → append `data` to the active block's data field
 * - `block-delta` → shallow-merge `fields` onto the active block
 *
 * @example
 * ```ts
 * // Text token
 * { event: "content-block-delta", index: 0,
 *   delta: { type: "text-delta", text: " world" } }
 *
 * // Tool call args snapshot
 * { event: "content-block-delta", index: 1,
 *   delta: { type: "block-delta",
 *     fields: { type: "tool_call_chunk", args: '{"q":"wea' } } } }
 *
 * // Provider-specific field (e.g., signature)
 * { event: "content-block-delta", index: 0,
 *   delta: { type: "block-delta",
 *     fields: { type: "reasoning", signature: "sig_abc" } } }
 * ```
 */
export interface ContentBlockDeltaEvent {
  event: "content-block-delta";
  /** Positional index of the block being updated. */
  index: number;
  /** Incremental content block delta. */
  delta: ContentBlockDelta;
}

/**
 * Emitted when a content block is complete.
 *
 * @example
 * ```ts
 * { event: "content-block-finish", index: 0,
 *   content: { type: "text", text: "Hello world" } }
 * ```
 */
export interface ContentBlockFinishEvent {
  event: "content-block-finish";
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
  event: "usage";
  /** Current usage snapshot. */
  usage: Partial<UsageMetadata>;
}

// ─── Provider Passthrough ───────────────────────────────────────

/**
 * Passthrough for native provider events that don't map to standard types.
 */
export interface ProviderEvent {
  event: "provider";
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
  event: "error";
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
