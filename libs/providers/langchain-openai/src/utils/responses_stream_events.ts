/**
 * Converts OpenAI Responses API stream events into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import { OpenAI as OpenAIClient } from "openai";
import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import { convertResponsesUsageToUsageMetadata } from "../converters/responses.js";

export interface ConvertOpenAIResponsesStreamOptions {
  streamUsage?: boolean;
  provider?: string;
}

type RawEvent = OpenAIClient.Responses.ResponseStreamEvent;
type BlockKey = `text:${number}` | `reasoning:${number}` | `tool:${number}`;

export async function* convertOpenAIResponsesStream(
  source: AsyncIterable<RawEvent>,
  options: ConvertOpenAIResponsesStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const provider = options.provider ?? "openai";

  const blockAccumulators = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();
  const blockKeyToIndex = new Map<BlockKey, number>();
  let nextBlockIndex = 0;
  let messageStarted = false;
  let messageId: string | undefined;
  let usageSnapshot: UsageMetadata | undefined;
  let finishReason: FinishReason | undefined;
  let responseMetadata: Record<string, unknown> | undefined;
  const finalizedBlockIndices = new Set<number>();

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

  const ensureMessageStart = function* () {
    if (!messageStarted) {
      messageStarted = true;
      yield {
        event: "message-start" as const,
        id: messageId,
      };
    }
  };

  const finalizeBlock = function* (index: number) {
    if (finalizedBlockIndices.has(index)) {
      return;
    }
    const acc = blockAccumulators.get(index);
    if (!acc) {
      return;
    }
    finalizedBlockIndices.add(index);
    yield {
      event: "content-block-finish" as const,
      index,
      content: finalizeContentBlock(acc as ContentBlock),
    };
  };

  for await (const event of source) {
    if (event.type === "response.created") {
      messageId = event.response.id;
      yield* ensureMessageStart();
      yield {
        event: "provider" as const,
        provider,
        name: "response.created",
        payload: { model: event.response.model, id: event.response.id },
      };
      continue;
    }

    if (event.type === "response.output_text.delta") {
      yield* ensureMessageStart();
      const key: BlockKey = `text:${event.content_index}`;
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
      acc.text = (acc.text ?? "") + event.delta;
      yield {
        event: "content-block-delta" as const,
        index,
        delta: { type: "text-delta" as const, text: event.delta },
      };
      continue;
    }

    if (event.type === "response.reasoning_summary_text.delta") {
      yield* ensureMessageStart();
      const key: BlockKey = `reasoning:${event.summary_index}`;
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
      acc.reasoning = (acc.reasoning ?? "") + event.delta;
      yield {
        event: "content-block-delta" as const,
        index,
        delta: { type: "reasoning-delta" as const, reasoning: event.delta },
      };
      continue;
    }

    if (
      event.type === "response.output_item.added" &&
      (event.item.type === "function_call" ||
        event.item.type === "custom_tool_call")
    ) {
      yield* ensureMessageStart();
      const key: BlockKey = `tool:${event.output_index}`;
      const isCustom = event.item.type === "custom_tool_call";
      const initialArgs =
        event.item.type === "function_call"
          ? (event.item.arguments ?? "")
          : (event.item.input ?? "");
      const { index, isNew } = getOrCreateBlockIndex(key, {
        type: "tool_call_chunk",
        id: event.item.call_id,
        name: event.item.name,
        args: initialArgs,
        index: event.output_index,
        ...(isCustom ? { isCustomTool: true } : {}),
      });
      if (isNew) {
        yield {
          event: "content-block-start" as const,
          index,
          content: {
            type: "tool_call_chunk",
            id: event.item.call_id,
            name: event.item.name,
            args: initialArgs,
            index: event.output_index,
          } as ContentBlock,
        };
      }
      if (initialArgs) {
        const acc = blockAccumulators.get(index)!;
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
      }
      continue;
    }

    if (
      event.type === "response.function_call_arguments.delta" ||
      event.type === "response.custom_tool_call_input.delta"
    ) {
      yield* ensureMessageStart();
      const key: BlockKey = `tool:${event.output_index}`;
      const { index, isNew } = getOrCreateBlockIndex(key, {
        type: "tool_call_chunk",
        args: "",
        index: event.output_index,
        ...(event.type === "response.custom_tool_call_input.delta"
          ? { isCustomTool: true }
          : {}),
      });
      if (isNew) {
        yield {
          event: "content-block-start" as const,
          index,
          content: {
            type: "tool_call_chunk",
            args: "",
            index: event.output_index,
          } as ContentBlock,
        };
      }
      const acc = blockAccumulators.get(index)!;
      acc.args = (acc.args ?? "") + event.delta;
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
      continue;
    }

    if (
      event.type === "response.output_item.done" &&
      (event.item.type === "function_call" ||
        event.item.type === "custom_tool_call")
    ) {
      yield* ensureMessageStart();
      const key: BlockKey = `tool:${event.output_index}`;
      const args =
        event.item.type === "function_call"
          ? (event.item.arguments ?? "")
          : (event.item.input ?? "");
      const { index, isNew } = getOrCreateBlockIndex(key, {
        type: "tool_call_chunk",
        id: event.item.call_id,
        name: event.item.name,
        args,
        index: event.output_index,
      });
      if (isNew) {
        yield {
          event: "content-block-start" as const,
          index,
          content: {
            type: "tool_call_chunk",
            id: event.item.call_id,
            name: event.item.name,
            args,
            index: event.output_index,
          } as ContentBlock,
        };
      } else {
        const acc = blockAccumulators.get(index)!;
        acc.args = args;
        acc.id = event.item.call_id;
        acc.name = event.item.name;
      }
      yield* finalizeBlock(index);
      continue;
    }

    if (
      event.type === "response.completed" ||
      event.type === "response.incomplete"
    ) {
      yield* ensureMessageStart();
      messageId = event.response.id;
      finishReason = mapResponseStatusToFinishReason(
        event.response.status,
        event.type
      );
      responseMetadata = {
        model_provider: provider,
        id: event.response.id,
        model: event.response.model,
        status: event.response.status,
      };
      if (shouldStreamUsage && event.response.usage) {
        usageSnapshot = convertResponsesUsageToUsageMetadata(
          event.response.usage
        );
        yield { event: "usage" as const, usage: usageSnapshot };
      }
      continue;
    }

    if (event.type === "response.image_generation_call.partial_image") {
      continue;
    }

    yield* ensureMessageStart();
    yield {
      event: "provider" as const,
      provider,
      name: event.type,
      payload: event,
    };
  }

  if (!messageStarted) {
    yield { event: "message-start" as const };
  }

  for (const [index] of blockAccumulators) {
    if (!finalizedBlockIndices.has(index)) {
      yield* finalizeBlock(index);
    }
  }

  yield {
    event: "message-finish" as const,
    reason: finishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    ...(responseMetadata ? { responseMetadata } : {}),
  };
}

function mapResponseStatusToFinishReason(
  status: string | undefined,
  eventType: "response.completed" | "response.incomplete"
): FinishReason {
  if (eventType === "response.incomplete") {
    return "length";
  }
  if (status === "completed") {
    return "stop";
  }
  if (status === "incomplete") {
    return "length";
  }
  return "stop";
}
