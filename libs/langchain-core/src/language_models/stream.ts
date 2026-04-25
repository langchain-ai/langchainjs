/**
 * Typed stream classes for chat model streaming.
 *
 * @module
 */

import { AIMessage } from "../messages/ai.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { UsageMetadata } from "../messages/metadata.js";
import type { ChatModelStreamEvent } from "./event.js";

type UsageMetadataLike = Partial<UsageMetadata>;

// ─── Replay Buffer ──────────────────────────────────────────────

/**
 * A buffer that caches emitted events for replay.
 *
 * Multiple consumers can independently iterate the same buffer —
 * each gets its own cursor. Events are never consumed or removed.
 *
 * @internal
 */
class ReplayBuffer {
  private events: ChatModelStreamEvent[] = [];
  private finished = false;
  private waiters: Array<() => void> = [];
  private error: Error | null = null;

  push(event: ChatModelStreamEvent): void {
    this.events.push(event);
    const toWake = this.waiters.splice(0);
    for (const waiter of toWake) {
      waiter();
    }
  }

  finish(): void {
    this.finished = true;
    const toWake = this.waiters.splice(0);
    for (const waiter of toWake) {
      waiter();
    }
  }

  setError(err: Error): void {
    this.error = err;
    this.finished = true;
    const toWake = this.waiters.splice(0);
    for (const waiter of toWake) {
      waiter();
    }
  }

  async *iterate(): AsyncGenerator<ChatModelStreamEvent> {
    if (this.finished) {
      if (this.error) throw this.error;
      yield* this.events;
      return;
    }

    let cursor = 0;
    while (true) {
      while (cursor < this.events.length) {
        yield this.events[cursor]!;
        cursor++;
      }
      if (this.finished) {
        if (this.error) throw this.error;
        return;
      }
      await new Promise<void>((resolve) => {
        if (cursor < this.events.length || this.finished) {
          resolve();
          return;
        }
        this.waiters.push(resolve);
      });
    }
  }
}

// ─── Accumulator ────────────────────────────────────────────────

/**
 * Apply a typed delta to an accumulated content block.
 *
 * - `text` → append text
 * - `reasoning` / provider `thinking` → append reasoning text
 * - `tool_call_chunk` / `server_tool_call_chunk` → append args while
 *   preserving id/name from previous chunks when a later delta omits them
 * - other block types → shallow merge
 *
 * @internal
 */
function applyDelta(block: ContentBlock, delta: ContentBlock): ContentBlock {
  if (block.type !== delta.type) {
    return { ...delta };
  }

  if (
    (delta as { type?: string }).type === "thinking" &&
    (block as { type?: string }).type === "thinking"
  ) {
    const thinking =
      ((block as { thinking?: string }).thinking ?? "") +
      ((delta as { thinking?: string }).thinking ?? "");
    return { ...block, ...delta, thinking } as unknown as ContentBlock;
  }

  switch (delta.type) {
    case "text":
      return {
        ...block,
        ...delta,
        text: ((block as { text?: string }).text ?? "") + delta.text,
      };
    case "reasoning":
      return {
        ...block,
        ...delta,
        reasoning:
          ((block as { reasoning?: string }).reasoning ?? "") + delta.reasoning,
      };
    case "tool_call_chunk":
    case "server_tool_call_chunk": {
      const merged = { ...block, ...delta } as Record<string, unknown>;
      if (delta.id == null && "id" in block && block.id != null) {
        merged.id = block.id;
      }
      if (delta.name == null && "name" in block && block.name != null) {
        merged.name = block.name;
      }
      merged.args = `${("args" in block ? block.args : "") ?? ""}${delta.args ?? ""}`;
      return merged as unknown as ContentBlock;
    }
    default:
      return { ...block, ...delta };
  }
}

function getReasoningDelta(content: unknown): string | undefined {
  if (content == null || typeof content !== "object") return undefined;
  const block = content as {
    type?: string;
    reasoning?: unknown;
    thinking?: unknown;
  };
  if (block.type === "reasoning" && typeof block.reasoning === "string") {
    return block.reasoning;
  }
  if (block.type === "thinking" && typeof block.thinking === "string") {
    return block.thinking;
  }
  return undefined;
}

function isReasoningContent(content: unknown): boolean {
  if (content == null || typeof content !== "object") return false;
  const type = (content as { type?: unknown }).type;
  return type === "reasoning" || type === "thinking";
}

/**
 * Normalize protocol-compatible partial usage into Core's concrete usage shape.
 *
 * Some stream sources emit usage snapshots without every aggregate token field.
 * Keep the stream event input permissive, then normalize at read time so
 * high-level Core consumers always receive a complete {@link UsageMetadata}.
 */
function normalizeUsage(
  usage: UsageMetadataLike | undefined
): UsageMetadata | undefined {
  if (!usage) return undefined;
  return {
    ...usage,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    total_tokens: usage.total_tokens ?? 0,
  };
}

// ─── Sub-Stream: Text ───────────────────────────────────────────

/**
 * Typed stream for text content.
 *
 * - **Iterate**: yields incremental text deltas.
 * - **Await**: resolves to the complete concatenated text.
 * - **`.full`**: yields the running accumulated text after each delta.
 */
export class TextContentStream
  implements AsyncIterable<string>, PromiseLike<string>
{
  /** @internal */
  private _buffer: ReplayBuffer;

  /** @internal */
  constructor(buffer: ReplayBuffer) {
    this._buffer = buffer;
  }

  /** Yields the accumulated text so far after each delta. */
  get full(): AsyncIterable<string> {
    const buffer = this._buffer;
    return {
      async *[Symbol.asyncIterator]() {
        let accumulated = "";
        for await (const event of buffer.iterate()) {
          if (
            event.event === "content-block-delta" &&
            event.content.type === "text" &&
            typeof event.content.text === "string"
          ) {
            accumulated += event.content.text;
            yield accumulated;
          }
        }
      },
    };
  }

  /** Yields incremental text deltas. */
  [Symbol.asyncIterator](): AsyncIterator<string> {
    const buffer = this._buffer;
    async function* gen() {
      for await (const event of buffer.iterate()) {
        if (
          event.event === "content-block-delta" &&
          event.content.type === "text" &&
          typeof event.content.text === "string"
        ) {
          yield event.content.text;
        }
      }
    }
    return gen();
  }

  then<TResult1 = string, TResult2 = never>(
    onfulfilled?: ((value: string) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const promise = (async () => {
      let text = "";
      for await (const delta of this) {
        text += delta;
      }
      return text;
    })();
    return promise.then(onfulfilled, onrejected);
  }
}

// ─── Sub-Stream: Tool Calls ─────────────────────────────────────

/**
 * Typed stream for tool calls.
 *
 * - **Iterate**: yields individual `ToolCall` objects as each completes.
 * - **Await**: resolves to the full array.
 * - **`.full`**: yields the accumulated array after each new tool call.
 */
export class ToolCallsStream
  implements
    AsyncIterable<ContentBlock.Tools.ToolCall>,
    PromiseLike<Array<ContentBlock.Tools.ToolCall>>
{
  /** @internal */
  private _buffer: ReplayBuffer;

  /** @internal */
  constructor(buffer: ReplayBuffer) {
    this._buffer = buffer;
  }

  get full(): AsyncIterable<Array<ContentBlock.Tools.ToolCall>> {
    const buffer = this._buffer;
    return {
      async *[Symbol.asyncIterator]() {
        const calls: Array<ContentBlock.Tools.ToolCall> = [];
        for await (const event of buffer.iterate()) {
          if (
            event.event === "content-block-finish" &&
            event.content.type === "tool_call"
          ) {
            calls.push(event.content as ContentBlock.Tools.ToolCall);
            yield [...calls];
          }
        }
      },
    };
  }

  [Symbol.asyncIterator](): AsyncIterator<ContentBlock.Tools.ToolCall> {
    const buffer = this._buffer;
    async function* gen() {
      for await (const event of buffer.iterate()) {
        if (
          event.event === "content-block-finish" &&
          event.content.type === "tool_call"
        ) {
          yield event.content as ContentBlock.Tools.ToolCall;
        }
      }
    }
    return gen();
  }

  then<TResult1 = Array<ContentBlock.Tools.ToolCall>, TResult2 = never>(
    onfulfilled?:
      | ((
          value: Array<ContentBlock.Tools.ToolCall>
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const promise = (async () => {
      const calls: Array<ContentBlock.Tools.ToolCall> = [];
      for await (const call of this) {
        calls.push(call);
      }
      return calls;
    })();
    return promise.then(onfulfilled, onrejected);
  }
}

// ─── Sub-Stream: Reasoning ──────────────────────────────────────

/**
 * Typed stream for reasoning content (chain-of-thought).
 * Same interface as {@link TextContentStream} but for reasoning blocks.
 */
export class ReasoningContentStream
  implements AsyncIterable<string>, PromiseLike<string>
{
  /** @internal */
  private _buffer: ReplayBuffer;

  /** @internal */
  constructor(buffer: ReplayBuffer) {
    this._buffer = buffer;
  }

  get full(): AsyncIterable<string> {
    const buffer = this._buffer;
    return {
      async *[Symbol.asyncIterator]() {
        let accumulated = "";
        let seenReasoning = false;
        for await (const event of buffer.iterate()) {
          if (event.event === "content-block-start") {
            if (!isReasoningContent(event.content)) {
              if (seenReasoning) return;
              continue;
            }
            seenReasoning = true;
            const delta = getReasoningDelta(event.content);
            if (delta == null || delta.length === 0) continue;
            accumulated += delta;
            yield accumulated;
          } else if (event.event === "content-block-delta") {
            if (!isReasoningContent(event.content)) continue;
            seenReasoning = true;
            const delta = getReasoningDelta(event.content);
            if (delta == null || delta.length === 0) continue;
            accumulated += delta;
            yield accumulated;
          } else if (
            event.event === "content-block-finish" &&
            isReasoningContent(event.content)
          ) {
            return;
          } else if (event.event === "message-finish") {
            return;
          }
        }
      },
    };
  }

  [Symbol.asyncIterator](): AsyncIterator<string> {
    const buffer = this._buffer;
    async function* gen() {
      let seenReasoning = false;
      for await (const event of buffer.iterate()) {
        if (event.event === "content-block-start") {
          if (!isReasoningContent(event.content)) {
            if (seenReasoning) return;
            continue;
          }
          seenReasoning = true;
          const delta = getReasoningDelta(event.content);
          if (delta != null && delta.length > 0) yield delta;
        } else if (event.event === "content-block-delta") {
          if (!isReasoningContent(event.content)) continue;
          seenReasoning = true;
          const delta = getReasoningDelta(event.content);
          if (delta != null && delta.length > 0) yield delta;
        } else if (
          event.event === "content-block-finish" &&
          isReasoningContent(event.content)
        ) {
          return;
        } else if (event.event === "message-finish") {
          return;
        }
      }
    }
    return gen();
  }

  then<TResult1 = string, TResult2 = never>(
    onfulfilled?: ((value: string) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const promise = (async () => {
      let text = "";
      for await (const delta of this) {
        text += delta;
      }
      return text;
    })();
    return promise.then(onfulfilled, onrejected);
  }
}

// ─── Sub-Stream: Usage ──────────────────────────────────────────

/**
 * Typed stream for usage metadata.
 */
export class UsageMetadataStream
  implements
    AsyncIterable<UsageMetadata>,
    PromiseLike<UsageMetadata | undefined>
{
  /** @internal */
  private _buffer: ReplayBuffer;

  /** @internal */
  constructor(buffer: ReplayBuffer) {
    this._buffer = buffer;
  }

  [Symbol.asyncIterator](): AsyncIterator<UsageMetadata> {
    const buffer = this._buffer;
    async function* gen() {
      for await (const event of buffer.iterate()) {
        if (event.event === "usage") {
          const usage = normalizeUsage(event.usage);
          if (usage) yield usage;
        } else if (event.event === "message-start" && event.usage) {
          const usage = normalizeUsage(event.usage);
          if (usage) yield usage;
        } else if (event.event === "message-finish" && event.usage) {
          const usage = normalizeUsage(event.usage);
          if (usage) yield usage;
        }
      }
    }
    return gen();
  }

  then<TResult1 = UsageMetadata | undefined, TResult2 = never>(
    onfulfilled?:
      | ((value: UsageMetadata | undefined) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const promise = (async () => {
      let latest: UsageMetadata | undefined;
      for await (const usage of this) {
        latest = usage;
      }
      return latest;
    })();
    return promise.then(onfulfilled, onrejected);
  }
}

// ─── ChatModelStream ────────────────────────────────────────────

/**
 * The main stream object returned by chat model streaming.
 *
 * Implements `AsyncIterable<ChatModelStreamEvent>` for raw event access
 * and `PromiseLike<AIMessage>` for simple `await` usage.
 */
export class ChatModelStream
  implements AsyncIterable<ChatModelStreamEvent>, PromiseLike<AIMessage>
{
  /** @internal */
  private _buffer: ReplayBuffer;

  /** @internal */
  constructor(source: AsyncIterable<ChatModelStreamEvent>) {
    this._buffer = new ReplayBuffer();
    this._consume(source);
  }

  /** @internal */
  private async _consume(
    source: AsyncIterable<ChatModelStreamEvent>
  ): Promise<void> {
    try {
      for await (const event of source) {
        this._buffer.push(event);
      }
      this._buffer.finish();
    } catch (err) {
      this._buffer.setError(
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<ChatModelStreamEvent> {
    return this._buffer.iterate();
  }

  get text(): TextContentStream {
    return new TextContentStream(this._buffer);
  }

  get toolCalls(): ToolCallsStream {
    return new ToolCallsStream(this._buffer);
  }

  get reasoning(): ReasoningContentStream {
    return new ReasoningContentStream(this._buffer);
  }

  get usage(): UsageMetadataStream {
    return new UsageMetadataStream(this._buffer);
  }

  get output(): PromiseLike<AIMessage> {
    return { then: (onf, onr) => this._assembleMessage().then(onf, onr) };
  }

  then<TResult1 = AIMessage, TResult2 = never>(
    onfulfilled?:
      | ((value: AIMessage) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this._assembleMessage().then(onfulfilled, onrejected);
  }

  /** @internal */
  private async _assembleMessage(): Promise<AIMessage> {
    const contentBlocks: Array<ContentBlock | undefined> = [];
    let id: string | undefined;
    let usage: UsageMetadata | undefined;
    let metadata: Record<string, unknown> = {};
    let finishReason: string | undefined;

    for await (const event of this._buffer.iterate()) {
      switch (event.event) {
        case "message-start":
          id = event.id ?? id;
          if (event.usage) usage = normalizeUsage(event.usage);
          break;

        case "content-block-start":
          contentBlocks[event.index] = event.content;
          break;

        case "content-block-delta": {
          const current = contentBlocks[event.index];
          if (current) {
            contentBlocks[event.index] = applyDelta(current, event.content);
          }
          break;
        }

        case "content-block-finish":
          contentBlocks[event.index] = event.content;
          break;

        case "usage":
          usage = normalizeUsage(event.usage);
          break;

        case "message-finish":
          finishReason = event.reason;
          if (event.usage) usage = normalizeUsage(event.usage);
          if (event.metadata) {
            metadata = {
              ...metadata,
              ...event.metadata,
            };
          }
          break;

        default:
          break;
      }
    }

    const filteredBlocks = contentBlocks.filter(
      (b): b is ContentBlock => b != null
    );

    return new AIMessage({
      id,
      content: filteredBlocks,
      usage_metadata: usage,
      response_metadata: {
        ...metadata,
        ...(finishReason ? { finish_reason: finishReason } : {}),
        output_version: "v1" as const,
      },
    });
  }
}
