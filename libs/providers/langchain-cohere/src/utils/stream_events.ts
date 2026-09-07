/**
 * Converts Cohere chat stream events into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export type CohereStreamChunk = Record<string, any>;

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
  const toolBlocks = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();

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
      const response = chunk.response ?? {};
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
        const args =
          typeof tc.function?.arguments === "string"
            ? tc.function.arguments
            : JSON.stringify(tc.function?.arguments ?? {});
        const initial = {
          type: "tool_call_chunk" as const,
          id: tc.id,
          name: tc.function?.name,
          args,
          index,
        };
        toolBlocks.set(index, { ...initial });
        yield {
          event: "content-block-start" as const,
          index,
          content: initial as ContentBlock,
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
      content: finalizeContentBlock(acc as ContentBlock),
    };
  }

  yield {
    event: "message-finish" as const,
    reason: "stop" as FinishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    responseMetadata: { model_provider: "cohere" },
  };
}
