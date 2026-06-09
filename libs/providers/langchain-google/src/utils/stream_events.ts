/**
 * Converts Gemini stream responses into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import type { Gemini } from "../chat_models/api-types.js";

export type GeminiStreamResponse = Gemini.GenerateContentResponse;

export interface ConvertGoogleGeminiStreamOptions {
  streamUsage?: boolean;
}

type BlockKey = "text" | "reasoning" | `tool:${number}`;

export async function* convertGoogleGeminiStream(
  source: AsyncIterable<GeminiStreamResponse>,
  options: ConvertGoogleGeminiStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const blockAccumulators = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();
  const blockKeyToIndex = new Map<BlockKey, number>();
  let nextBlockIndex = 0;
  let messageStarted = false;
  let usageSnapshot: UsageMetadata | undefined;

  const getOrCreateBlockIndex = (
    key: BlockKey,
    initial: Record<string, unknown>
  ): { index: number; isNew: boolean } => {
    const existing = blockKeyToIndex.get(key);
    if (existing !== undefined) {
      return { index: existing, isNew: false };
    }
    const index = nextBlockIndex++;
    blockKeyToIndex.set(key, index);
    blockAccumulators.set(index, { ...initial });
    return { index, isNew: true };
  };

  for await (const response of source) {
    if (!messageStarted) {
      messageStarted = true;
      yield { event: "message-start" as const };
    }

    const usageMetadata = response.usageMetadata ?? response.usage_metadata;
    if (shouldStreamUsage && usageMetadata) {
      const input = usageMetadata.promptTokenCount ?? 0;
      const output = usageMetadata.candidatesTokenCount ?? 0;
      usageSnapshot = {
        input_tokens: input,
        output_tokens: output,
        total_tokens: usageMetadata.totalTokenCount ?? input + output,
      };
      yield { event: "usage" as const, usage: usageSnapshot };
    }

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) continue;

    let toolIdx = 0;
    for (const part of parts) {
      if (part.text) {
        if (part.thought) {
          const key: BlockKey = "reasoning";
          const { index, isNew } = getOrCreateBlockIndex(key, {
            type: "reasoning",
            reasoning: "",
          });
          if (isNew) {
            yield {
              event: "content-block-start" as const,
              index,
              content: { type: "reasoning", reasoning: "" } as ContentBlock,
            };
          }
          const acc = blockAccumulators.get(index)!;
          acc.reasoning = (acc.reasoning ?? "") + part.text;
          yield {
            event: "content-block-delta" as const,
            index,
            delta: { type: "reasoning-delta" as const, reasoning: part.text },
          };
        } else {
          const key: BlockKey = "text";
          const { index, isNew } = getOrCreateBlockIndex(key, {
            type: "text",
            text: "",
          });
          if (isNew) {
            yield {
              event: "content-block-start" as const,
              index,
              content: { type: "text", text: "" } as ContentBlock,
            };
          }
          const acc = blockAccumulators.get(index)!;
          acc.text = (acc.text ?? "") + part.text;
          yield {
            event: "content-block-delta" as const,
            index,
            delta: { type: "text-delta" as const, text: part.text },
          };
        }
      } else if (part.functionCall) {
        const key: BlockKey = `tool:${toolIdx}`;
        const args = JSON.stringify(part.functionCall.args ?? {});
        const { index, isNew } = getOrCreateBlockIndex(key, {
          type: "tool_call_chunk",
          name: part.functionCall.name,
          args: "",
          index: toolIdx,
        });
        if (isNew) {
          yield {
            event: "content-block-start" as const,
            index,
            content: {
              type: "tool_call_chunk",
              name: part.functionCall.name,
              args: "",
              index: toolIdx,
            } as ContentBlock,
          };
        }
        const acc = blockAccumulators.get(index)!;
        acc.args = args;
        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "block-delta" as const,
            fields: {
              type: "tool_call_chunk",
              name: acc.name,
              args: acc.args,
            },
          },
        };
        toolIdx += 1;
      }
    }
  }

  for (const [index, acc] of blockAccumulators) {
    yield {
      event: "content-block-finish" as const,
      index,
      content: finalizeContentBlock(acc as ContentBlock),
    };
  }

  yield {
    event: "message-finish" as const,
    reason: "stop",
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: { model_provider: "google" },
  };
}
