/**
 * Converts Gemini stream responses into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
  MessageFinishEvent,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import { v4 as uuidv4 } from "@langchain/core/utils/uuid";
import type { Gemini } from "../../chat_models/types.js";
import { promptBlockedError } from "../../utils/errors.js";

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
  let rawFinishReason: string | undefined;
  // Kept so the finished message gets the same refusal block as `invoke`.
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

    const usageMetadata =
      response.usageMetadata ??
      (
        response as {
          usage_metadata?: Gemini.GenContent.GenerateContentResponse["usageMetadata"];
        }
      ).usage_metadata;
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

    if (response.promptFeedback?.blockReason) {
      throw promptBlockedError(response.promptFeedback);
    }

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason) {
      rawFinishReason = candidate.finishReason;
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
    ...mapGeminiFinishReason(
      rawFinishReason,
      [...blockKeyToIndex.keys()].some((key) => key.startsWith("tool:"))
    ),
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: {
      model_provider: "google",
      ...(rawFinishReason ? { finishReason: rawFinishReason } : {}),
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

function mapGeminiFinishReason(
  reason: string | undefined,
  sawToolCall: boolean
): Pick<
  MessageFinishEvent,
  "finishReason" | "normalizedFinishReason" | "finishState" | "reason"
> {
  if (!reason) return {};
  let normalizedFinishReason: FinishReason;
  switch (reason.toLowerCase().replace(/-/g, "_")) {
    case "stop":
      normalizedFinishReason = sawToolCall ? "tool_call" : "stop";
      break;
    case "max_tokens":
    case "max_token":
      normalizedFinishReason = "length";
      break;
    case "safety":
    case "blocklist":
    case "prohibited_content":
      normalizedFinishReason = "refusal";
      break;
    case "recitation":
    case "language":
    case "spii":
    case "image_safety":
    case "image_prohibited_content":
    case "image_recitation":
      normalizedFinishReason = "content_filter";
      break;
    default:
      normalizedFinishReason = "other";
  }
  return {
    finishReason: reason,
    normalizedFinishReason,
    reason: toLegacyReason(normalizedFinishReason),
    finishState: "complete",
  };
}

// Keeps the deprecated `reason` populated with its old values.
function toLegacyReason(reason: FinishReason): MessageFinishEvent["reason"] {
  if (reason === "tool_call") return "tool_use";
  if (reason === "refusal") return "content_filter";
  if (reason === "context_exceeded") return "length";
  return reason === "other" || reason === "error" ? undefined : reason;
}
