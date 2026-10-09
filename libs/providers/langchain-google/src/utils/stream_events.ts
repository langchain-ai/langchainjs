/**
 * Converts Gemini stream responses into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import { v4 as uuidv4 } from "@langchain/core/utils/uuid";
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
  let finishReason: FinishReason = "stop";
  let groundingMetadata: Gemini.GroundingMetadata | undefined;
  let citationMetadata: Gemini.CitationMetadata | undefined;

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

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason) {
      finishReason = mapGeminiFinishReason(candidate.finishReason);
    }
    if (candidate?.groundingMetadata) {
      groundingMetadata = candidate.groundingMetadata;
    }
    if (candidate?.citationMetadata) {
      citationMetadata = candidate.citationMetadata;
    }

    const parts = candidate?.content?.parts;
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
          if (part.thoughtSignature)
            acc.thoughtSignature = part.thoughtSignature;
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
        // Only used to seed a *new* block; an id already assigned to this
        // block must not change on later chunks.
        const candidateId =
          part.functionCall.id ?? `lc-tool-call-${uuidv4().replace(/-/g, "")}`;
        const { index, isNew } = getOrCreateBlockIndex(key, {
          type: "tool_call_chunk",
          id: candidateId,
          name: part.functionCall.name,
          args: "",
          index: toolIdx,
        });
        const acc = blockAccumulators.get(index)!;
        const id = acc.id as string;
        if (isNew) {
          yield {
            event: "content-block-start" as const,
            index,
            content: {
              type: "tool_call_chunk",
              id,
              name: part.functionCall.name,
              args: "",
              index: toolIdx,
            } as ContentBlock,
          };
        }
        acc.args = args;
        if (part.thoughtSignature) acc.thoughtSignature = part.thoughtSignature;
        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "block-delta" as const,
            fields: {
              type: "tool_call_chunk",
              id,
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
    // finalizeContentBlock rebuilds tool_call_chunk -> tool_call as
    // {type, id, name, args} only, so thoughtSignature has to be re-attached.
    const finalized = finalizeContentBlock(acc as ContentBlock);
    yield {
      event: "content-block-finish" as const,
      index,
      content: acc.thoughtSignature
        ? ({
            ...finalized,
            thoughtSignature: acc.thoughtSignature,
          } as ContentBlock)
        : finalized,
    };
  }

  yield {
    event: "message-finish" as const,
    reason: finishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: {
      model_provider: "google",
      ...(citationMetadata ? { citationMetadata } : {}),
      ...(groundingMetadata
        ? {
            groundingMetadata,
            // Support entries for the first content part only (matches messages.ts).
            groundingSupport: groundingMetadata.groundingSupports?.filter(
              (s) => (s?.segment?.partIndex ?? 0) === 0
            ),
          }
        : {}),
    },
  };
}

function mapGeminiFinishReason(reason: string): FinishReason {
  switch (reason.toLowerCase()) {
    case "max_tokens":
    case "max-token":
    case "max_token":
      return "length";
    case "safety":
    case "recitation":
    case "language":
    case "blocklist":
    case "prohibited_content":
    case "prohibited-content":
    case "spii":
    case "image_safety":
    case "image-safety":
    case "image_prohibited_content":
    case "image-prohibited-content":
    case "image_recitation":
    case "image-recitation":
      return "content_filter";
    default:
      return "stop";
  }
}
