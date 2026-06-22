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
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";

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
  let finishReason: FinishReason | undefined;

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
      } else if (delta.toolUse) {
        const acc = blockAccumulators.get(index);
        if (!acc) {
          throw new Error(
            `Received tool use delta for content block index ${index} before a matching content block start event.`
          );
        }
        acc.args = (acc.args ?? "") + (delta.toolUse.input ?? "");
        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "block-delta" as const,
            fields: {
              type: "tool_call_chunk",
              ...(acc.id != null ? { id: acc.id } : {}),
              ...(acc.name != null ? { name: acc.name } : {}),
              args: acc.args,
            },
          },
        };
      } else if (delta.reasoningContent) {
        const text = delta.reasoningContent.text;
        if (typeof text === "string") {
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
          acc.reasoning = (acc.reasoning ?? "") + text;
          yield {
            event: "content-block-delta" as const,
            index,
            delta: { type: "reasoning-delta" as const, reasoning: text },
          };
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
      };
      yield { event: "usage" as const, usage: usageSnapshot };
    } else if (event.messageStop?.stopReason) {
      finishReason = mapStopReason(event.messageStop.stopReason);
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
    reason: finishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: { model_provider: "bedrock-converse" },
  };
}

function mapStopReason(stopReason: string): FinishReason {
  switch (stopReason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "length";
    case "guardrail_intervened":
    case "content_filtered":
      return "content_filter";
    default:
      return "stop";
  }
}
