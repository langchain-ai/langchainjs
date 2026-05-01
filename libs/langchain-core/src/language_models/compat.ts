/**
 * Compatibility bridge: converts legacy `_streamResponseChunks`
 * (`ChatGenerationChunk` / `AIMessageChunk`) output to the new
 * `ChatModelStreamEvent` protocol.
 *
 * @module
 */

import { AIMessageChunk } from "../messages/ai.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { ChatGenerationChunk } from "../outputs.js";
import type { ChatModelStreamEvent, ContentBlockDelta } from "./event.js";

const MIME_TYPE_BY_AUDIO_FORMAT: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  flac: "audio/flac",
  opus: "audio/opus",
  aac: "audio/aac",
  pcm16: "audio/pcm",
};

const MIME_TYPE_BY_IMAGE_FORMAT: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

type AudioStreamState = {
  index: number;
  id?: string;
  mimeType: string;
  transcript: string;
};

function nextBlockIndex(activeBlocks: Map<number, unknown>): number {
  let next = 0;
  for (const index of activeBlocks.keys()) {
    if (index >= next) next = index + 1;
  }
  return next;
}

function getAdditionalKwargs(message: unknown): Record<string, unknown> {
  const additional = (message as { additional_kwargs?: unknown })
    .additional_kwargs;
  return additional != null && typeof additional === "object"
    ? (additional as Record<string, unknown>)
    : {};
}

function extractImageBlocksFromToolOutputs(message: unknown): ContentBlock[] {
  const toolOutputs = getAdditionalKwargs(message).tool_outputs;
  if (!Array.isArray(toolOutputs)) return [];

  const blocks: ContentBlock[] = [];
  for (const entry of toolOutputs) {
    if (entry == null || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (record.type !== "image_generation_call") continue;

    const data = typeof record.result === "string" ? record.result : undefined;
    const url = typeof record.url === "string" ? record.url : undefined;
    if (data == null && url == null) continue;

    const outputFormat =
      typeof record.output_format === "string"
        ? record.output_format.toLowerCase()
        : undefined;
    const mimeType =
      (outputFormat != null
        ? MIME_TYPE_BY_IMAGE_FORMAT[outputFormat]
        : undefined) ?? "image/png";

    blocks.push({
      type: "image",
      ...(typeof record.id === "string" ? { id: record.id } : {}),
      ...(url != null ? { url } : {}),
      ...(data != null ? { data } : {}),
      mimeType,
    } as ContentBlock);
  }
  return blocks;
}

/**
 * Get the audio payload from the message.
 *
 * This handles the OpenAI-shaped `additional_kwargs.audio` payload used by
 * legacy chunk streams; other providers must normalize into this shape first.
 *
 * @param message - The message to get the audio payload from.
 * @returns The audio payload.
 * @internal
 */
function getAudioPayload(message: unknown):
  | {
      id?: string;
      data?: string;
      url?: string;
      transcript?: string;
      mimeType: string;
    }
  | undefined {
  const audio = getAdditionalKwargs(message).audio;
  if (audio == null || typeof audio !== "object") return undefined;
  const record = audio as Record<string, unknown>;

  const data = typeof record.data === "string" ? record.data : undefined;
  const url = typeof record.url === "string" ? record.url : undefined;
  const transcript =
    typeof record.transcript === "string" ? record.transcript : undefined;
  if (data == null && url == null && transcript == null) return undefined;

  const explicitMimeType =
    typeof record.mime_type === "string"
      ? record.mime_type
      : typeof record.mimeType === "string"
        ? record.mimeType
        : undefined;
  const format =
    typeof record.format === "string" ? record.format.toLowerCase() : undefined;
  const mimeType =
    explicitMimeType ??
    (format != null ? MIME_TYPE_BY_AUDIO_FORMAT[format] : undefined) ??
    (data != null ? "audio/wav" : "audio/pcm");

  return {
    ...(typeof record.id === "string" ? { id: record.id } : {}),
    ...(data != null ? { data } : {}),
    ...(url != null ? { url } : {}),
    ...(transcript != null ? { transcript } : {}),
    mimeType,
  };
}

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
  let audioStream: AudioStreamState | undefined;
  const emittedImageKeys = new Set<string>();

  for await (const chunk of chunks) {
    options?.signal?.throwIfAborted();

    const msg = chunk.message;

    // Message start
    let usageHandledInStart = false;
    if (!messageStarted) {
      messageStarted = true;
      const startEvent: ChatModelStreamEvent = {
        event: "message-start" as const,
        id: msg.id ?? undefined,
      };
      if (AIMessageChunk.isInstance(msg) && msg.usage_metadata) {
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
            event: "content-block-start" as const,
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
          event: "content-block-delta" as const,
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
            event: "content-block-start" as const,
            index: blockIndex,
            content: { ...part },
          };
        } else {
          const block = activeBlocks.get(blockIndex)!;
          const delta = contentBlockToDelta(part);
          block.accumulated = applyDeltaToBlock(block.accumulated, delta);
          yield {
            event: "content-block-delta" as const,
            index: blockIndex,
            delta,
          };
        }
      }
    }

    // Tool call chunks
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
            event: "content-block-start" as const,
            index: blockIndex,
            content: initial,
          };
        }

        // Accumulate tool call args internally, emit incremental content chunks.
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
          event: "content-block-delta" as const,
          index: blockIndex,
          delta: {
            type: "block-delta" as const,
            fields: {
              type: "tool_call_chunk",
              ...("id" in acc && acc.id != null ? { id: acc.id } : {}),
              ...("name" in acc && acc.name != null ? { name: acc.name } : {}),
              args: acc.args,
            },
          },
        };
      }
    }

    const audioPayload = getAudioPayload(msg);
    if (audioPayload != null) {
      if (audioStream == null) {
        const index = nextBlockIndex(activeBlocks);
        audioStream = {
          index,
          id: audioPayload.id,
          mimeType: audioPayload.mimeType,
          transcript: "",
        };
        const initial = {
          type: "audio",
          ...(audioPayload.id != null ? { id: audioPayload.id } : {}),
          ...(audioPayload.url != null ? { url: audioPayload.url } : {}),
          data: "",
          mimeType: audioPayload.mimeType,
        } as ContentBlock;
        activeBlocks.set(index, {
          type: "audio",
          accumulated: initial,
        });
        yield {
          event: "content-block-start" as const,
          index,
          content: initial,
        };
      }

      const activeAudio = activeBlocks.get(audioStream.index);
      if (activeAudio != null) {
        const accumulated = activeAudio.accumulated as ContentBlock & {
          data?: string;
          transcript?: string;
        };
        if (audioPayload.id != null && audioStream.id == null) {
          audioStream.id = audioPayload.id;
          (accumulated as { id?: string }).id = audioPayload.id;
        }
        if (audioPayload.transcript != null) {
          audioStream.transcript += audioPayload.transcript;
          accumulated.transcript = audioStream.transcript;
          yield {
            event: "content-block-delta" as const,
            index: audioStream.index,
            delta: {
              type: "block-delta" as const,
              fields: {
                type: "audio",
                transcript: audioStream.transcript,
              },
            },
          };
        }
        if (audioPayload.data != null && audioPayload.data.length > 0) {
          accumulated.data = (accumulated.data ?? "") + audioPayload.data;
          yield {
            event: "content-block-delta" as const,
            index: audioStream.index,
            delta: {
              type: "data-delta" as const,
              data: audioPayload.data,
              encoding: "base64" as const,
            },
          };
        }
      }
    }

    for (const imageBlock of extractImageBlocksFromToolOutputs(msg)) {
      const imageRecord = imageBlock as ContentBlock & {
        id?: string;
        url?: string;
        data?: string;
      };
      const imageKey =
        imageRecord.id ??
        imageRecord.url ??
        (imageRecord.data != null
          ? `${imageRecord.data.length}:${imageRecord.data.slice(0, 32)}`
          : undefined);
      if (imageKey != null && emittedImageKeys.has(imageKey)) continue;
      if (imageKey != null) emittedImageKeys.add(imageKey);

      const index = nextBlockIndex(activeBlocks);
      activeBlocks.set(index, {
        type: "image",
        accumulated: imageBlock,
      });
      yield {
        event: "content-block-start" as const,
        index,
        content: imageBlock,
      };
    }

    // Usage
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
      yield { event: "usage" as const, usage: { ...lastUsage } };
    }
  }

  // Finish all blocks
  for (const [index, block] of activeBlocks) {
    const finalized = finalizeContentBlock(block.accumulated);
    yield {
      event: "content-block-finish" as const,
      index,
      content: finalized,
    };
  }

  yield {
    event: "message-finish" as const,
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
      } as ContentBlock;
    case "reasoning-delta":
      if ((block as { type?: string }).type === "thinking") {
        return {
          ...block,
          thinking:
            ((block as { thinking?: string }).thinking ?? "") + delta.reasoning,
        } as unknown as ContentBlock;
      }
      return {
        ...block,
        reasoning:
          ((block as { reasoning?: string }).reasoning ?? "") + delta.reasoning,
      } as ContentBlock;
    case "data-delta":
      return {
        ...block,
        data: ((block as { data?: string }).data ?? "") + delta.data,
      } as ContentBlock;
    case "block-delta":
      return { ...block, ...delta.fields } as ContentBlock;
    default:
      throw new Error(`Unknown delta type: ${JSON.stringify(delta)}`);
  }
}

function contentBlockToDelta(block: ContentBlock): ContentBlockDelta {
  if (block.type === "text") {
    return { type: "text-delta", text: (block as ContentBlock.Text).text };
  }
  if (block.type === "reasoning") {
    return {
      type: "reasoning-delta",
      reasoning: (block as ContentBlock.Reasoning).reasoning,
    };
  }
  if (
    (block as { type?: string }).type === "thinking" &&
    typeof (block as { thinking?: unknown }).thinking === "string"
  ) {
    return {
      type: "reasoning-delta",
      reasoning: (block as unknown as { thinking: string }).thinking,
    };
  }
  if (typeof (block as { data?: unknown }).data === "string") {
    return {
      type: "data-delta",
      data: (block as unknown as { data: string }).data,
      encoding: "base64",
    };
  }
  if (typeof (block as { type?: unknown }).type === "string") {
    return {
      type: "block-delta",
      fields: {
        ...(block as unknown as { type: string } & Record<string, unknown>),
      },
    };
  }

  throw new Error(`Unsupported content block delta: ${JSON.stringify(block)}`);
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
