/**
 * Converts Bedrock Converse stream events into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import type * as Bedrock from "@aws-sdk/client-bedrock-runtime";
import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
  MessageFinishEvent,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import { getReasoningTokensFromAdditionalFields } from "./message_outputs.js";

export interface ConvertBedrockConverseStreamOptions {
  streamUsage?: boolean;
}

type StreamEvent = Bedrock.ConverseStreamOutput;

export async function* convertBedrockConverseStream(
  source: AsyncIterable<StreamEvent>,
  options: ConvertBedrockConverseStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const blockAccumulators = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();
  let messageStarted = false;
  let usageSnapshot: UsageMetadata | undefined;
  let rawStopReason: string | undefined;
  let reasoningTokens: number | undefined;

  for await (const event of source) {
    if (!messageStarted) {
      messageStarted = true;
      yield { event: "message-start" as const };
    }

    if (event.contentBlockStart) {
      const index = event.contentBlockStart.contentBlockIndex ?? 0;
      const toolUse = event.contentBlockStart.start?.toolUse;
      if (toolUse) {
        const initial = {
          type: "tool_call_chunk" as const,
          id: toolUse.toolUseId,
          name: toolUse.name,
          args: "",
          index,
        };
        blockAccumulators.set(index, { ...initial });
        yield {
          event: "content-block-start" as const,
          index,
          content: initial as ContentBlock,
        };
      }
    } else if (event.contentBlockDelta) {
      const index = event.contentBlockDelta.contentBlockIndex ?? 0;
      const delta = event.contentBlockDelta.delta;
      if (!delta) continue;

      if (typeof delta.text === "string") {
        if (!blockAccumulators.has(index)) {
          const initial = { type: "text" as const, text: "" };
          blockAccumulators.set(index, { ...initial });
          yield {
            event: "content-block-start" as const,
            index,
            content: initial as ContentBlock,
          };
        }
        const acc = blockAccumulators.get(index)!;
        acc.text = (acc.text ?? "") + delta.text;
        yield {
          event: "content-block-delta" as const,
          index,
          delta: { type: "text-delta" as const, text: delta.text },
        };
      } else if (delta.toolUse?.input) {
        const acc = blockAccumulators.get(index);
        if (!acc) continue;
        acc.args = (acc.args ?? "") + delta.toolUse.input;
        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "tool-call-delta" as const,
            args: delta.toolUse.input,
          },
        };
      } else if (delta.reasoningContent) {
        const text = delta.reasoningContent.text;
        const signature = delta.reasoningContent.signature;
        if (typeof text === "string" || typeof signature === "string") {
          if (!blockAccumulators.has(index)) {
            const initial = { type: "reasoning" as const, reasoning: "" };
            blockAccumulators.set(index, { ...initial });
            yield {
              event: "content-block-start" as const,
              index,
              content: initial as ContentBlock,
            };
          }
          const acc = blockAccumulators.get(index)!;
          if (typeof text === "string") {
            acc.reasoning = (acc.reasoning ?? "") + text;
            yield {
              event: "content-block-delta" as const,
              index,
              delta: { type: "reasoning-delta" as const, reasoning: text },
            };
          } else if (typeof signature === "string") {
            acc.signature = (acc.signature ?? "") + signature;
            yield {
              event: "content-block-delta" as const,
              index,
              delta: {
                type: "block-delta" as const,
                fields: { type: "reasoning", signature: acc.signature },
              },
            };
          }
        }
      }
    } else if (event.metadata?.usage && shouldStreamUsage) {
      const u = event.metadata.usage;
      const cacheRead = u.cacheReadInputTokens ?? 0;
      const cacheWrite = u.cacheWriteInputTokens ?? 0;
      const input = (u.inputTokens ?? 0) + cacheRead + cacheWrite;
      const output = u.outputTokens ?? 0;
      usageSnapshot = {
        input_tokens: input,
        output_tokens: output,
        total_tokens: u.totalTokens ?? input + output,
        input_token_details: {
          ...(u.cacheReadInputTokens != null
            ? { cache_read: u.cacheReadInputTokens }
            : {}),
          ...(u.cacheWriteInputTokens != null
            ? { cache_creation: u.cacheWriteInputTokens }
            : {}),
        },
        ...(reasoningTokens !== undefined
          ? { output_token_details: { reasoning: reasoningTokens } }
          : {}),
      };
      yield { event: "usage" as const, usage: usageSnapshot };
    } else if (event.messageStop?.stopReason) {
      rawStopReason = event.messageStop.stopReason;
      reasoningTokens = getReasoningTokensFromAdditionalFields(
        event.messageStop.additionalModelResponseFields
      );
      // Usage may already have arrived; message-finish carries the patched snapshot.
      if (usageSnapshot && reasoningTokens !== undefined) {
        usageSnapshot = {
          ...usageSnapshot,
          output_token_details: { reasoning: reasoningTokens },
        };
      }
    } else {
      yield {
        event: "provider" as const,
        provider: "bedrock-converse",
        name: "stream_event",
        payload: event,
      };
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
    ...mapStopReason(rawStopReason),
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: { model_provider: "bedrock-converse" },
  };
}

function mapStopReason(
  reason: string | undefined
): Pick<
  MessageFinishEvent,
  "finishReason" | "normalizedFinishReason" | "finishState"
> {
  if (!reason) return {};
  let normalizedFinishReason: FinishReason;
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      normalizedFinishReason = "stop";
      break;
    case "tool_use":
      normalizedFinishReason = "tool_call";
      break;
    case "max_tokens":
    case "model_context_window_exceeded":
      normalizedFinishReason = "length";
      break;
    case "guardrail_intervened":
    case "content_filtered":
      normalizedFinishReason = "content_filter";
      break;
    default:
      normalizedFinishReason = "other";
  }
  return {
    finishReason: reason,
    normalizedFinishReason,
    finishState: "complete",
  };
}
