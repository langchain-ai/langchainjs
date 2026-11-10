/**
 * Converts Cohere chat stream events into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import type { Cohere } from "cohere-ai";
import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import * as uuid from "@langchain/core/utils/uuid";

export type CohereStreamChunk = Cohere.StreamedChatResponse;

export interface ConvertCohereStreamOptions {
  streamUsage?: boolean;
}

export async function* convertCohereStream(
  source: AsyncIterable<CohereStreamChunk>,
  options: ConvertCohereStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  let messageStarted = false;
  const textIndex = 0;
  let textStarted = false;
  let accumulatedText = "";
  let usageSnapshot: UsageMetadata | undefined;
  const toolBlocks = new Map<number, ContentBlock.Tools.ToolCallChunk>();

  for await (const chunk of source) {
    if (!messageStarted) {
      messageStarted = true;
      yield { event: "message-start" as const };
    }

    if (
      chunk.eventType === "text-generation" &&
      typeof chunk.text === "string"
    ) {
      if (!textStarted) {
        textStarted = true;
        yield {
          event: "content-block-start" as const,
          index: textIndex,
          content: { type: "text", text: "" } as ContentBlock,
        };
      }
      accumulatedText += chunk.text;
      yield {
        event: "content-block-delta" as const,
        index: textIndex,
        delta: { type: "text-delta" as const, text: chunk.text },
      };
    } else if (chunk.eventType === "stream-end") {
      const response: Partial<Cohere.NonStreamedChatResponse> =
        chunk.response ?? {};
      if (shouldStreamUsage && response.meta?.tokens) {
        const input = response.meta.tokens.inputTokens ?? 0;
        const output = response.meta.tokens.outputTokens ?? 0;
        usageSnapshot = {
          input_tokens: input,
          output_tokens: output,
          total_tokens: input + output,
        };
        yield { event: "usage" as const, usage: usageSnapshot };
      }

      const toolCalls = response.toolCalls ?? [];
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const index = textStarted ? i + 1 : i;
        const initial: ContentBlock.Tools.ToolCallChunk = {
          type: "tool_call_chunk",
          // Cohere's tool calls carry no id; generate one the way
          // `ChatCohere._formatCohereToolCalls` does.
          id: uuid.v4().substring(0, 32),
          name: tc.name,
          args: JSON.stringify(tc.parameters ?? {}),
          index,
        };
        toolBlocks.set(index, { ...initial });
        yield {
          event: "content-block-start" as const,
          index,
          content: initial,
        };
      }
    } else {
      yield {
        event: "provider" as const,
        provider: "cohere",
        name: chunk.eventType ?? "unknown",
        payload: chunk,
      };
    }
  }

  if (textStarted) {
    yield {
      event: "content-block-finish" as const,
      index: textIndex,
      content: { type: "text", text: accumulatedText } as ContentBlock,
    };
  }

  for (const [index, acc] of toolBlocks) {
    yield {
      event: "content-block-finish" as const,
      index,
      content: finalizeContentBlock(acc),
    };
  }

  yield {
    event: "message-finish" as const,
    reason: "stop" as FinishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: { model_provider: "cohere" },
  };
}
