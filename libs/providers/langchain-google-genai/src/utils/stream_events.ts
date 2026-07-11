/**
 * Converts Google Generative AI stream responses into ChatModelStreamEvents.
 *
 * @module
 */

import type { EnhancedGenerateContentResponse } from "@google/generative-ai";
import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import { v4 as uuidv4 } from "@langchain/core/utils/uuid";
import {
  _FUNCTION_CALL_THOUGHT_SIGNATURES_MAP_KEY,
  convertUsageMetadata,
} from "./common.js";

export interface ConvertGoogleGenAIStreamOptions {
  streamUsage?: boolean;
  model?: string;
}

type BlockKey = "text" | "reasoning" | `tool:${number}`;

export async function* convertGoogleGenAIStream(
  source: AsyncIterable<EnhancedGenerateContentResponse>,
  options: ConvertGoogleGenAIStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const blockAccumulators = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();
  const blockKeyToIndex = new Map<BlockKey, number>();
  const functionThoughtSignatures: Record<string, string> = {};
  let nextBlockIndex = 0;
  let messageStarted = false;
  let usageSnapshot: UsageMetadata | undefined;
  let finishReason: FinishReason = "stop";

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

    if (
      shouldStreamUsage &&
      "usageMetadata" in response &&
      response.usageMetadata
    ) {
      usageSnapshot = convertUsageMetadata(
        response.usageMetadata,
        options.model ?? ""
      );
      yield { event: "usage" as const, usage: usageSnapshot };
    }

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason) {
      finishReason = mapGeminiFinishReason(candidate.finishReason);
    }

    const parts = candidate?.content?.parts;
    if (!parts) continue;

    let toolIdx = 0;
    for (const part of parts) {
      if ("text" in part && part.text) {
        if ("thought" in part && part.thought) {
          const key: BlockKey = "reasoning";
          const { index, isNew } = getOrCreateBlockIndex(key, {
            type: "reasoning",
            reasoning: "",
            ...(part.thoughtSignature
              ? { signature: part.thoughtSignature }
              : {}),
          });
          const acc = blockAccumulators.get(index)!;
          if (part.thoughtSignature) {
            acc.signature = part.thoughtSignature;
          }
          if (isNew) {
            yield {
              event: "content-block-start" as const,
              index,
              content: { ...acc } as ContentBlock,
            };
          }
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
      } else if ("functionCall" in part && part.functionCall) {
        const key: BlockKey = `tool:${toolIdx}`;
        const args = JSON.stringify(part.functionCall.args ?? {});
        const functionCallId =
          "id" in part.functionCall &&
          typeof part.functionCall.id === "string" &&
          part.functionCall.id
            ? part.functionCall.id
            : uuidv4();
        const { index, isNew } = getOrCreateBlockIndex(key, {
          type: "tool_call_chunk",
          id: functionCallId,
          name: part.functionCall.name,
          args: "",
          index: toolIdx,
        });
        const acc = blockAccumulators.get(index)!;
        if (part.thoughtSignature) {
          functionThoughtSignatures[acc.id] = part.thoughtSignature;
        }
        if (isNew) {
          yield {
            event: "content-block-start" as const,
            index,
            content: { ...acc } as ContentBlock,
          };
        }
        acc.args = args;
        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "block-delta" as const,
            fields: {
              type: "tool_call_chunk",
              id: acc.id,
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
    reason: finishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: {
      model_provider: "google-genai",
      ...(Object.keys(functionThoughtSignatures).length
        ? {
            [_FUNCTION_CALL_THOUGHT_SIGNATURES_MAP_KEY]:
              functionThoughtSignatures,
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
