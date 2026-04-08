/**
 * Compatibility bridge: converts legacy `_streamResponseChunks`
 * (`ChatGenerationChunk` / `AIMessageChunk`) output to the new
 * `ChatModelStreamEvent` protocol.
 *
 * This module is used by `BaseChatModel._streamChatModelEvents` as
 * the default implementation when a provider has not yet implemented
 * native event streaming.
 *
 * @module
 */

import { AIMessageChunk } from "../messages/ai.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { ChatGenerationChunk } from "../outputs.js";
import type { ChatModelStreamEvent } from "./event.js";

/**
 * Convert an async iterable of legacy `ChatGenerationChunk`s into
 * `ChatModelStreamEvent`s.
 *
 * Tracks content blocks by index, synthesizes start/delta/finish events,
 * and emits usage updates. Handles both string content and array content
 * blocks, as well as tool call chunks.
 *
 * @param chunks - The legacy chunk stream from `_streamResponseChunks`.
 * @param options - Optional signal for abort handling.
 * @returns An async generator of {@link ChatModelStreamEvent}.
 */
export async function* convertChunksToEvents(
  chunks: AsyncIterable<ChatGenerationChunk>,
  options?: { signal?: AbortSignal }
): AsyncGenerator<ChatModelStreamEvent> {
  // Track active content blocks for the bridge
  const activeBlocks = new Map<
    number,
    { started: boolean; accumulated: ContentBlock }
  >();
  let messageStarted = false;
  let lastUsage:
    | { input_tokens: number; output_tokens: number; total_tokens: number }
    | undefined;

  for await (const chunk of chunks) {
    options?.signal?.throwIfAborted();

    const msg = chunk.message;

    // Emit message-start on the first chunk
    let usageHandledInStart = false;
    if (!messageStarted) {
      messageStarted = true;
      const startEvent: ChatModelStreamEvent = {
        type: "message-start" as const,
        id: msg.id ?? undefined,
      };
      // If first chunk has usage (e.g., Anthropic input tokens)
      if (AIMessageChunk.isInstance(msg) && msg.usage_metadata) {
        (startEvent as { usage?: unknown }).usage = msg.usage_metadata;
        lastUsage = { ...msg.usage_metadata };
        usageHandledInStart = true;
      }
      yield startEvent;
    }

    // Process content from the chunk
    const content = msg.content;
    if (typeof content === "string") {
      if (content !== "") {
        // Simple string content → single text block at index 0
        const blockIndex = 0;

        if (!activeBlocks.has(blockIndex)) {
          const initial: ContentBlock.Text = { type: "text", text: "" };
          activeBlocks.set(blockIndex, {
            started: true,
            accumulated: initial,
          });
          yield {
            type: "content-block-start" as const,
            index: blockIndex,
            content: initial,
          };
        }

        const block = activeBlocks.get(blockIndex)!;
        const prevText = (block.accumulated as ContentBlock.Text).text;
        const accumulated: ContentBlock.Text = {
          type: "text",
          text: prevText + content,
        };
        block.accumulated = accumulated;

        yield {
          type: "content-block-delta" as const,
          index: blockIndex,
          content: accumulated,
        };
      }
    } else if (Array.isArray(content)) {
      for (const part of content) {
        const blockIndex =
          typeof part.index === "number" ? part.index : activeBlocks.size;

        if (!activeBlocks.has(blockIndex)) {
          activeBlocks.set(blockIndex, {
            started: true,
            accumulated: { ...part },
          });
          yield {
            type: "content-block-start" as const,
            index: blockIndex,
            content: { ...part },
          };
        } else {
          // Accumulate into existing block
          const block = activeBlocks.get(blockIndex)!;
          const accumulated = accumulateContentBlock(block.accumulated, part);
          block.accumulated = accumulated;

          yield {
            type: "content-block-delta" as const,
            index: blockIndex,
            content: accumulated,
          };
        }
      }
    }

    // Handle tool call chunks from the legacy path
    if (
      AIMessageChunk.isInstance(msg) &&
      msg.tool_call_chunks &&
      msg.tool_call_chunks.length > 0
    ) {
      for (const toolChunk of msg.tool_call_chunks) {
        const blockIndex =
          typeof toolChunk.index === "number"
            ? toolChunk.index
            : activeBlocks.size;

        const delta: ContentBlock = {
          type: "tool_call_chunk" as const,
          id: toolChunk.id,
          name: toolChunk.name,
          args: toolChunk.args,
          index: blockIndex,
        };

        if (!activeBlocks.has(blockIndex)) {
          activeBlocks.set(blockIndex, {
            started: true,
            accumulated: { ...delta },
          });
          yield {
            type: "content-block-start" as const,
            index: blockIndex,
            content: { ...delta },
          };
        } else {
          const block = activeBlocks.get(blockIndex)!;
          const accumulated = accumulateContentBlock(block.accumulated, delta);
          block.accumulated = accumulated;

          yield {
            type: "content-block-delta" as const,
            index: blockIndex,
            content: accumulated,
          };
        }
      }
    }

    // Accumulate usage (legacy chunks use additive usage, not snapshots)
    if (
      !usageHandledInStart &&
      AIMessageChunk.isInstance(msg) &&
      msg.usage_metadata
    ) {
      const chunkUsage = msg.usage_metadata;
      if (!lastUsage) {
        lastUsage = { ...chunkUsage };
      } else {
        lastUsage = {
          input_tokens: lastUsage.input_tokens + chunkUsage.input_tokens,
          output_tokens: lastUsage.output_tokens + chunkUsage.output_tokens,
          total_tokens: lastUsage.total_tokens + chunkUsage.total_tokens,
        };
      }
      yield { type: "usage" as const, usage: { ...lastUsage } };
    }
  }

  // Emit content-block-finish for all active blocks
  for (const [index, block] of activeBlocks) {
    const finalized = finalizeContentBlock(block.accumulated);
    yield {
      type: "content-block-finish" as const,
      index,
      content: finalized,
    };
  }

  // Emit message-finish
  yield {
    type: "message-finish" as const,
    reason: "stop" as const,
    ...(lastUsage ? { usage: lastUsage } : {}),
  };
}

/**
 * Accumulate a content block delta into the running snapshot.
 */
export function accumulateContentBlock(
  accumulated: ContentBlock,
  delta: ContentBlock
): ContentBlock {
  if (accumulated.type === "text" && delta.type === "text") {
    return {
      ...accumulated,
      type: "text" as const,
      text:
        (accumulated as ContentBlock.Text).text +
        ((delta as ContentBlock.Text).text ?? ""),
    } as ContentBlock.Text;
  }

  if (accumulated.type === "reasoning" && delta.type === "reasoning") {
    return {
      ...accumulated,
      type: "reasoning" as const,
      reasoning:
        (accumulated as ContentBlock.Reasoning).reasoning +
        ((delta as ContentBlock.Reasoning).reasoning ?? ""),
    } as ContentBlock.Reasoning;
  }

  if (
    (accumulated.type === "tool_call_chunk" ||
      accumulated.type === "tool_call") &&
    (delta.type === "tool_call_chunk" || delta.type === "tool_call")
  ) {
    const accTC = accumulated as ContentBlock.Tools.ToolCallChunk;
    const deltaTC = delta as ContentBlock.Tools.ToolCallChunk;
    return {
      ...accumulated,
      type: "tool_call_chunk" as const,
      id: accTC.id ?? deltaTC.id,
      name: accTC.name ?? deltaTC.name,
      args: (accTC.args ?? "") + (deltaTC.args ?? ""),
      index: accTC.index ?? deltaTC.index,
    } as ContentBlock.Tools.ToolCallChunk;
  }

  // For block types we don't know how to merge, just spread the delta over
  return { ...accumulated, ...delta };
}

/**
 * Finalize a content block for the finish event.
 *
 * For tool calls, attempts to parse the accumulated args JSON string
 * into an object, upgrading from `tool_call_chunk` to `tool_call`.
 */
export function finalizeContentBlock(block: ContentBlock): ContentBlock {
  if (block.type === "tool_call_chunk") {
    const chunk = block as ContentBlock.Tools.ToolCallChunk;
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(chunk.args ?? "{}");
    } catch {
      // If JSON parsing fails, return as invalid tool call
      return {
        type: "invalid_tool_call" as const,
        id: chunk.id,
        name: chunk.name,
        args: chunk.args,
        error: "Failed to parse tool call arguments as JSON",
      } as ContentBlock.Tools.InvalidToolCall;
    }
    return {
      type: "tool_call" as const,
      id: chunk.id,
      name: chunk.name!,
      args: parsedArgs,
    } as ContentBlock.Tools.ToolCall;
  }

  return block;
}
