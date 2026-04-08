/**
 * Typed stream classes for chat model streaming.
 *
 * Provides {@link ChatModelStream} and typed sub-stream accessors that
 * implement both `AsyncIterable` (for incremental consumption) and
 * `PromiseLike` (for simple `await`).
 *
 * @module
 */

import { AIMessage } from "../messages/ai.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { UsageMetadata } from "../messages/metadata.js";
import type {
  ChatModelStreamEvent,
  ContentBlockDeltaEvent,
  ContentBlockFinishEvent,
} from "./event.js";

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
    // Wake ALL waiting consumers — each reads from their own cursor
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

  /**
   * Create an async iterator that replays cached events from the
   * beginning, then follows live events as they arrive.
   */
  async *iterate(): AsyncGenerator<ChatModelStreamEvent> {
    // Fast path: stream already done, replay everything
    if (this.finished) {
      if (this.error) throw this.error;
      yield* this.events;
      return;
    }

    // Live path: follow events as they arrive
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
      // Wait for new data
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

// ─── Helpers ────────────────────────────────────────────────────

/** Extract a string field from a loosely-typed content block. */
function getStringField(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>,
  field: string
): string {
  const val = obj[field];
  return typeof val === "string" ? val : "";
}

/** Check if a delta event carries a text content block. */
function isTextDelta(
  event: ChatModelStreamEvent
): event is ContentBlockDeltaEvent & {
  content: { type: "text"; text?: string };
} {
  return event.type === "content-block-delta" && event.content.type === "text";
}

/** Check if a delta event carries a reasoning content block. */
function isReasoningDelta(
  event: ChatModelStreamEvent
): event is ContentBlockDeltaEvent & {
  content: { type: "reasoning"; reasoning?: string };
} {
  return (
    event.type === "content-block-delta" && event.content.type === "reasoning"
  );
}

/** Check if a finish event carries a tool_call content block. */
function isToolCallFinish(
  event: ChatModelStreamEvent
): event is ContentBlockFinishEvent & {
  content: ContentBlock.Tools.ToolCall;
} {
  return (
    event.type === "content-block-finish" && event.content.type === "tool_call"
  );
}

// ─── Sub-Stream: Text ───────────────────────────────────────────

/**
 * Typed stream for text content.
 *
 * - **Iterate**: yields incremental text deltas (new tokens only).
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

  /**
   * Yields the accumulated text so far after each delta.
   */
  get full(): AsyncIterable<string> {
    const buffer = this._buffer;
    return {
      async *[Symbol.asyncIterator]() {
        for await (const event of buffer.iterate()) {
          if (isTextDelta(event)) {
            yield getStringField(
              event.content as Record<string, unknown>,
              "text"
            );
          }
        }
      },
    };
  }

  /**
   * Yields incremental text deltas (new tokens only).
   * Computed by diffing successive accumulated states.
   */
  [Symbol.asyncIterator](): AsyncIterator<string> {
    const buffer = this._buffer;
    async function* gen() {
      const prevLen = new Map<number, number>();
      for await (const event of buffer.iterate()) {
        if (isTextDelta(event)) {
          const full = getStringField(
            event.content as Record<string, unknown>,
            "text"
          );
          const prev = prevLen.get(event.index) ?? 0;
          if (full.length > prev) {
            yield full.slice(prev);
            prevLen.set(event.index, full.length);
          }
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
          if (isToolCallFinish(event)) {
            calls.push(event.content);
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
        if (isToolCallFinish(event)) {
          yield event.content;
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
        for await (const event of buffer.iterate()) {
          if (isReasoningDelta(event)) {
            yield getStringField(
              event.content as Record<string, unknown>,
              "reasoning"
            );
          }
        }
      },
    };
  }

  [Symbol.asyncIterator](): AsyncIterator<string> {
    const buffer = this._buffer;
    async function* gen() {
      const prevLen = new Map<number, number>();
      for await (const event of buffer.iterate()) {
        if (isReasoningDelta(event)) {
          const full = getStringField(
            event.content as Record<string, unknown>,
            "reasoning"
          );
          const prev = prevLen.get(event.index) ?? 0;
          if (full.length > prev) {
            yield full.slice(prev);
            prevLen.set(event.index, full.length);
          }
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
 *
 * - **Iterate**: yields usage snapshots as they arrive.
 * - **Await**: resolves to the final usage snapshot.
 */
export class UsageMetadataStream
  implements AsyncIterable<UsageMetadata>, PromiseLike<UsageMetadata>
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
        if (event.type === "usage") {
          yield event.usage;
        } else if (event.type === "message-start" && event.usage) {
          yield event.usage;
        } else if (event.type === "message-finish" && event.usage) {
          yield event.usage;
        }
      }
    }
    return gen();
  }

  then<TResult1 = UsageMetadata, TResult2 = never>(
    onfulfilled?:
      | ((value: UsageMetadata) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const promise = (async () => {
      let latest: UsageMetadata | undefined;
      for await (const usage of this) {
        latest = usage;
      }
      return latest ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
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
 *
 * All sub-streams are replay-safe: multiple consumers reading from the
 * same stream work correctly because each gets its own cursor over the
 * shared buffer.
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

  /** Iterate over raw {@link ChatModelStreamEvent}s. */
  [Symbol.asyncIterator](): AsyncIterator<ChatModelStreamEvent> {
    return this._buffer.iterate();
  }

  /** Text content deltas / full text. */
  get text(): TextContentStream {
    return new TextContentStream(this._buffer);
  }

  /** Completed tool calls. */
  get toolCalls(): ToolCallsStream {
    return new ToolCallsStream(this._buffer);
  }

  /** Reasoning content (chain-of-thought). */
  get reasoning(): ReasoningContentStream {
    return new ReasoningContentStream(this._buffer);
  }

  /** Usage metadata snapshots. */
  get usage(): UsageMetadataStream {
    return new UsageMetadataStream(this._buffer);
  }

  /** The fully assembled `AIMessage`, available once the stream finishes. */
  get output(): PromiseLike<AIMessage> {
    return { then: (onf, onr) => this._assembleMessage().then(onf, onr) };
  }

  /** Allows `await stream` to resolve to the fully assembled `AIMessage`. */
  then<TResult1 = AIMessage, TResult2 = never>(
    onfulfilled?:
      | ((value: AIMessage) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this._assembleMessage().then(onfulfilled, onrejected);
  }

  /**
   * Assemble all stream events into a finalized `AIMessage`.
   * @internal
   */
  private async _assembleMessage(): Promise<AIMessage> {
    const contentBlocks: Array<ContentBlock | undefined> = [];
    let id: string | undefined;
    let usage: UsageMetadata | undefined;
    let responseMetadata: Record<string, unknown> = {};
    let finishReason: string | undefined;

    for await (const event of this._buffer.iterate()) {
      switch (event.type) {
        case "message-start":
          id = event.id ?? id;
          if (event.usage) usage = event.usage;
          break;

        case "content-block-start":
        case "content-block-delta":
          // Overwrite with the latest accumulated snapshot
          contentBlocks[event.index] = event.content as ContentBlock;
          break;

        case "content-block-finish":
          contentBlocks[event.index] = event.content;
          break;

        case "usage":
          usage = event.usage;
          break;

        case "message-finish":
          finishReason = event.reason;
          if (event.usage) usage = event.usage;
          if (event.responseMetadata) {
            responseMetadata = {
              ...responseMetadata,
              ...event.responseMetadata,
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
        ...responseMetadata,
        ...(finishReason ? { finish_reason: finishReason } : {}),
        output_version: "v1" as const,
      },
    });
  }
}
