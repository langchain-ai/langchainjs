/**
 * Compatibility bridge: converts legacy `_streamResponseChunks`
 * (`ChatGenerationChunk` / `AIMessageChunk`) output to the new
 * `ChatModelStreamEvent` protocol.
 *
 * @module
 */

import { isAIMessageChunk } from "../messages/ai.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { ChatGenerationChunk } from "../outputs.js";
import type { ChatModelStreamEvent, ContentBlockDelta } from "./event.js";

/**
 * Convert an async iterable of legacy `ChatGenerationChunk`s into
 * `ChatModelStreamEvent`s with typed deltas.
 */
export async function* convertChunksToEvents(
  chunks: AsyncIterable<ChatGenerationChunk>,
  options?: { signal?: AbortSignal }
): AsyncGenerator<ChatModelStreamEvent> {
  const activeBlocks = new Map<
    number,
    { type: string; accumulated: ContentBlock }
  >();
  let messageStarted = false;
  let lastUsage:
    | { input_tokens: number; output_tokens: number; total_tokens: number }
    | undefined;

  for await (const chunk of chunks) {
    options?.signal?.throwIfAborted();

    const msg = chunk.message;

    // Message start
    let usageHandledInStart = false;
    if (!messageStarted) {
      messageStarted = true;
      const startEvent: ChatModelStreamEvent = {
        type: "message-start" as const,
        id: msg.id ?? undefined,
      };
      if (isAIMessageChunk(msg) && msg.usage_metadata) {
        (startEvent as { usage?: unknown }).usage = msg.usage_metadata;
        lastUsage = { ...msg.usage_metadata };
        usageHandledInStart = true;
      }
      yield startEvent;
    }

    // Process content
    const content = msg.content;
    if (typeof content === "string") {
      if (content !== "") {
        const blockIndex = 0;
        if (!activeBlocks.has(blockIndex)) {
          const initial: ContentBlock.Text = { type: "text", text: "" };
          activeBlocks.set(blockIndex, {
            type: "text",
            accumulated: initial,
          });
          yield {
            type: "content-block-start" as const,
            index: blockIndex,
            content: initial,
          };
        }
        const block = activeBlocks.get(blockIndex)!;
        block.accumulated = {
          ...block.accumulated,
          text: ((block.accumulated as { text?: string }).text ?? "") + content,
        };
        yield {
          type: "content-block-delta" as const,
          index: blockIndex,
          delta: { type: "text-delta" as const, text: content },
        };
      }
    } else if (Array.isArray(content)) {
      for (const part of content) {
        const blockIndex =
          typeof part.index === "number" ? part.index : activeBlocks.size;

        if (!activeBlocks.has(blockIndex)) {
          activeBlocks.set(blockIndex, {
            type: part.type,
            accumulated: { ...part },
          });
          yield {
            type: "content-block-start" as const,
            index: blockIndex,
            content: { ...part },
          };
        } else {
          const block = activeBlocks.get(blockIndex)!;
          const delta = contentBlockToDelta(part);
          block.accumulated = applyDeltaToBlock(block.accumulated, delta);
          yield {
            type: "content-block-delta" as const,
            index: blockIndex,
            delta,
          };
        }
      }
    }

    // Tool call chunks
    if (
      isAIMessageChunk(msg) &&
      msg.tool_call_chunks &&
      msg.tool_call_chunks.length > 0
    ) {
      for (const toolChunk of msg.tool_call_chunks) {
        const blockIndex =
          typeof toolChunk.index === "number"
            ? toolChunk.index
            : activeBlocks.size;

        if (!activeBlocks.has(blockIndex)) {
          const initial: ContentBlock = {
            type: "tool_call_chunk" as const,
            id: toolChunk.id,
            name: toolChunk.name,
            args: "",
            index: blockIndex,
          };
          activeBlocks.set(blockIndex, {
            type: "tool_call_chunk",
            accumulated: initial,
          });
          yield {
            type: "content-block-start" as const,
            index: blockIndex,
            content: initial,
          };
        }

        // Accumulate tool call args internally, emit as block-delta with snapshot
        const block = activeBlocks.get(blockIndex)!;
        const acc = block.accumulated as {
          args?: string;
          id?: string;
          name?: string;
        };
        if (toolChunk.id != null) acc.id = toolChunk.id;
        if (toolChunk.name != null) acc.name = toolChunk.name;
        acc.args = (acc.args ?? "") + (toolChunk.args ?? "");
        yield {
          type: "content-block-delta" as const,
          index: blockIndex,
          delta: {
            type: "block-delta" as const,
            fields: { ...block.accumulated },
          },
        };
      }
    }

    // Usage
    if (!usageHandledInStart && isAIMessageChunk(msg) && msg.usage_metadata) {
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

  // Finish all blocks
  for (const [index, block] of activeBlocks) {
    const finalized = finalizeContentBlock(block.accumulated);
    yield {
      type: "content-block-finish" as const,
      index,
      content: finalized,
    };
  }

  yield {
    type: "message-finish" as const,
    reason: "stop" as const,
    ...(lastUsage ? { usage: lastUsage } : {}),
  };
}

/**
 * Apply a typed delta to an accumulated content block.
 * @internal
 */
function applyDeltaToBlock(
  block: ContentBlock,
  delta: ContentBlockDelta
): ContentBlock {
  switch (delta.type) {
    case "text-delta":
      return {
        ...block,
        text: ((block as { text?: string }).text ?? "") + delta.text,
      };
    case "reasoning-delta":
      return {
        ...block,
        reasoning:
          ((block as { reasoning?: string }).reasoning ?? "") + delta.reasoning,
      };
    case "block-delta":
      return { ...block, ...delta.fields };
    default:
      return block;
  }
}

/**
 * Convert a legacy content block part to a typed delta.
 * @internal
 */
function contentBlockToDelta(part: ContentBlock): ContentBlockDelta {
  switch (part.type) {
    case "text":
      return {
        type: "text-delta" as const,
        text: (part as ContentBlock.Text).text ?? "",
      };
    case "reasoning":
      return {
        type: "reasoning-delta" as const,
        reasoning: (part as ContentBlock.Reasoning).reasoning ?? "",
      };
    case "tool_call_chunk":
    case "tool_call":
      return {
        type: "block-delta" as const,
        fields: part,
      };
    default:
      return {
        type: "block-delta" as const,
        fields: part,
      };
  }
}

/**
 * Finalize a content block for the finish event.
 * For tool calls, parse the accumulated JSON args string.
 */
export function finalizeContentBlock(block: ContentBlock): ContentBlock {
  if (block.type === "tool_call_chunk") {
    const chunk = block as ContentBlock.Tools.ToolCallChunk;
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(chunk.args ?? "{}");
    } catch {
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
