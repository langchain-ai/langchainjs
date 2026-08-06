/**
 * Converts Ollama chat stream chunks into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import { finalizeContentBlock } from "@langchain/core/language_models/compat";
import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock, UsageMetadata } from "@langchain/core/messages";

export interface OllamaStreamChunk {
  message: {
    role?: string;
    content?: string;
    thinking?: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> | string };
    }>;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  done?: boolean;
  done_reason?: string;
}

export interface ConvertOllamaStreamOptions {
  streamUsage?: boolean;
  think?: boolean;
}

type BlockKey = "text" | "reasoning" | `tool:${number}`;

export async function* convertOllamaStream(
  source: AsyncIterable<OllamaStreamChunk>,
  options: ConvertOllamaStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const preferThinking = options.think ?? false;

  const blockAccumulators = new Map<
    number,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    Record<string, any>
  >();
  const blockKeyToIndex = new Map<BlockKey, number>();
  let nextBlockIndex = 0;
  let messageStarted = false;
  let usageSnapshot: UsageMetadata | undefined;
  let finishReason: FinishReason | undefined;

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

  for await (const chunk of source) {
    if (!messageStarted) {
      messageStarted = true;
      yield { event: "message-start" as const };
    }

    if (shouldStreamUsage) {
      const input = chunk.prompt_eval_count ?? 0;
      const output = chunk.eval_count ?? 0;
      if (input > 0 || output > 0) {
        usageSnapshot = {
          input_tokens: input,
          output_tokens: output,
          total_tokens: input + output,
        };
        yield { event: "usage" as const, usage: usageSnapshot };
      }
    }

    if (chunk.done_reason) {
      finishReason = mapOllamaDoneReason(chunk.done_reason);
    }

    const { message } = chunk;

    if (preferThinking && message.thinking) {
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
      acc.reasoning = (acc.reasoning ?? "") + message.thinking;
      yield {
        event: "content-block-delta" as const,
        index,
        delta: {
          type: "reasoning-delta" as const,
          reasoning: message.thinking,
        },
      };
    }

    if (message.content) {
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
      acc.text = (acc.text ?? "") + message.content;
      yield {
        event: "content-block-delta" as const,
        index,
        delta: { type: "text-delta" as const, text: message.content },
      };
    }

    if (message.tool_calls?.length) {
      for (let i = 0; i < message.tool_calls.length; i++) {
        const tc = message.tool_calls[i]!;
        const key: BlockKey = `tool:${i}`;
        const args =
          typeof tc.function.arguments === "string"
            ? tc.function.arguments
            : JSON.stringify(tc.function.arguments);
        const { index, isNew } = getOrCreateBlockIndex(key, {
          type: "tool_call_chunk",
          name: tc.function.name,
          args: "",
          index: i,
        });
        if (isNew) {
          yield {
            event: "content-block-start" as const,
            index,
            content: {
              type: "tool_call_chunk",
              name: tc.function.name,
              args: "",
              index: i,
            } as ContentBlock,
          };
        }
        const acc = blockAccumulators.get(index)!;
        acc.name = tc.function.name;
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
    responseMetadata: { model_provider: "ollama" },
  };
}

function mapOllamaDoneReason(reason: string): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    default:
      return "stop";
  }
}
