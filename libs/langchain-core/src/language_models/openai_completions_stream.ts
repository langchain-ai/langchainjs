/**
 * Converts OpenAI Chat Completions-shaped stream chunks into
 * {@link ChatModelStreamEvent}s.
 *
 * Used by `@langchain/openai` and OpenAI-compatible providers (Groq, Mistral,
 * OpenRouter, IBM watsonx, etc.) without requiring a dependency on
 * `@langchain/openai`.
 *
 * @module
 */

import { finalizeContentBlock } from "./compat.js";
import type { ChatModelStreamEvent, FinishReason } from "./event.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { UsageMetadata } from "../messages/metadata.js";

export type OpenAICompletionsFinishReason =
  | "stop"
  | "length"
  | "max_tokens"
  | "tool_calls"
  | "function_call"
  | "content_filter"
  | null;

export interface OpenAICompletionsUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    audio_tokens?: number;
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    audio_tokens?: number;
    reasoning_tokens?: number;
  };
}

export interface OpenAICompletionsToolCallDelta {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface OpenAICompletionsDelta {
  role?: string;
  content?: string | null;
  reasoning_content?: string;
  reasoning?: string;
  tool_calls?: OpenAICompletionsToolCallDelta[];
  function_call?: unknown;
  audio?: {
    id?: string;
    data?: string;
    transcript?: string;
  };
}

export interface OpenAICompletionsStreamChoice {
  index?: number;
  finish_reason?: OpenAICompletionsFinishReason;
  logprobs?: unknown;
  delta?: OpenAICompletionsDelta;
}

export interface OpenAICompletionsStreamChunk {
  id?: string;
  model?: string;
  service_tier?: string | null;
  system_fingerprint?: string | null;
  usage?: OpenAICompletionsUsage | null;
  x_groq?: {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  choices?: OpenAICompletionsStreamChoice[];
}

export interface ConvertOpenAICompletionsStreamOptions {
  streamUsage?: boolean;
  /** Provider id for passthrough events (default `"openai"`). */
  provider?: string;
  /** Optional per-chunk transform before conversion. */
  mapChunk?: (
    chunk: OpenAICompletionsStreamChunk
  ) => OpenAICompletionsStreamChunk;
}

type BlockKey = "text" | "reasoning" | "audio" | `tool:${number}`;

/**
 * Convert an async iterable of OpenAI Chat Completions-shaped stream chunks into
 * LangChain `ChatModelStreamEvent`s with typed deltas.
 */
export async function* convertOpenAICompletionsStream(
  source: AsyncIterable<OpenAICompletionsStreamChunk>,
  options: ConvertOpenAICompletionsStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  const shouldStreamUsage = options.streamUsage ?? true;
  const provider = options.provider ?? "openai";
  const mapChunk = options.mapChunk;

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
  let responseMetadata: Record<string, unknown> | undefined;
  let emittedProviderMetadata = false;

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

  for await (let data of source) {
    if (mapChunk) {
      data = mapChunk(data);
    }
    if (!messageStarted) {
      messageStarted = true;
      yield {
        event: "message-start" as const,
        id: data.id,
      };
    }

    if (!emittedProviderMetadata && (data.model || data.service_tier)) {
      emittedProviderMetadata = true;
      yield {
        event: "provider" as const,
        provider,
        name: "stream_metadata",
        payload: {
          model: data.model,
          service_tier: data.service_tier,
        },
      };
    }

    if (data.usage && shouldStreamUsage) {
      usageSnapshot = buildUsageSnapshot(data.usage);
      yield { event: "usage" as const, usage: usageSnapshot };
    }

    const groqUsage = data.x_groq?.usage;
    if (groqUsage && shouldStreamUsage) {
      usageSnapshot = buildGroqUsageSnapshot(groqUsage);
      yield { event: "usage" as const, usage: usageSnapshot };
    }

    const choice = data.choices?.[0];
    if (!choice) {
      continue;
    }

    if (choice.finish_reason != null) {
      finishReason = mapFinishReason(choice.finish_reason);
      responseMetadata = buildResponseMetadata(data, choice);
    }

    const { delta } = choice;
    if (!delta) {
      continue;
    }

    const reasoningText = getReasoningDeltaText(delta);
    if (reasoningText) {
      const key: BlockKey = "reasoning";
      const { index, isNew } = getOrCreateBlockIndex(key, {
        type: "reasoning" as const,
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
      acc.reasoning = (acc.reasoning ?? "") + reasoningText;
      yield {
        event: "content-block-delta" as const,
        index,
        delta: {
          type: "reasoning-delta" as const,
          reasoning: reasoningText,
        },
      };
    }

    if (delta.content) {
      const key: BlockKey = "text";
      const { index, isNew } = getOrCreateBlockIndex(key, {
        type: "text" as const,
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
      acc.text = (acc.text ?? "") + delta.content;
      yield {
        event: "content-block-delta" as const,
        index,
        delta: { type: "text-delta" as const, text: delta.content },
      };
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const rawToolCall of delta.tool_calls) {
        const toolIndex = rawToolCall.index ?? 0;
        const key: BlockKey = `tool:${toolIndex}`;
        const { index, isNew } = getOrCreateBlockIndex(key, {
          type: "tool_call_chunk" as const,
          id: rawToolCall.id,
          name: rawToolCall.function?.name,
          args: "",
          index: toolIndex,
        });
        if (isNew) {
          yield {
            event: "content-block-start" as const,
            index,
            content: {
              type: "tool_call_chunk",
              id: rawToolCall.id,
              name: rawToolCall.function?.name,
              args: "",
              index: toolIndex,
            } as ContentBlock,
          };
        }

        const acc = blockAccumulators.get(index)!;
        if (rawToolCall.id != null) acc.id = rawToolCall.id;
        if (rawToolCall.function?.name != null) {
          acc.name = rawToolCall.function.name;
        }
        const argDelta = rawToolCall.function?.arguments ?? "";
        acc.args = (acc.args ?? "") + argDelta;
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
    }

    if (delta.audio) {
      const key: BlockKey = "audio";
      const { index, isNew } = getOrCreateBlockIndex(key, {
        type: "audio" as const,
        id: delta.audio.id,
        data: "",
        mimeType: "audio/pcm",
        transcript: delta.audio.transcript ?? "",
      });
      if (isNew) {
        yield {
          event: "content-block-start" as const,
          index,
          content: {
            type: "audio",
            id: delta.audio.id,
            data: "",
            mimeType: "audio/pcm",
            transcript: delta.audio.transcript ?? "",
          } as ContentBlock,
        };
      }
      const acc = blockAccumulators.get(index)!;
      if (delta.audio.transcript) {
        acc.transcript = (acc.transcript ?? "") + delta.audio.transcript;
        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "block-delta" as const,
            fields: {
              type: "audio",
              transcript: acc.transcript,
            },
          },
        };
      }
      if (delta.audio.data) {
        acc.data = (acc.data ?? "") + delta.audio.data;
        yield {
          event: "content-block-delta" as const,
          index,
          delta: {
            type: "data-delta" as const,
            data: delta.audio.data,
            encoding: "base64" as const,
          },
        };
      }
    }

    if (delta.function_call) {
      yield {
        event: "provider" as const,
        provider,
        name: "function_call",
        payload: delta.function_call,
      };
    }

    if (choice.logprobs) {
      yield {
        event: "provider" as const,
        provider,
        name: "logprobs",
        payload: choice.logprobs,
      };
    }
  }

  for (const [index, acc] of blockAccumulators) {
    const finalized = finalizeContentBlock(acc as ContentBlock);
    yield {
      event: "content-block-finish" as const,
      index,
      content: finalized,
    };
  }

  yield {
    event: "message-finish" as const,
    reason: finishReason,
    ...(usageSnapshot ? { usage: usageSnapshot } : {}),
    ...(responseMetadata ? { responseMetadata } : {}),
  };
}

function getReasoningDeltaText(
  delta: OpenAICompletionsDelta
): string | undefined {
  const reasoning = delta.reasoning_content ?? delta.reasoning;
  return typeof reasoning === "string" && reasoning.length > 0
    ? reasoning
    : undefined;
}

function buildGroqUsageSnapshot(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): UsageMetadata {
  return {
    input_tokens: usage.prompt_tokens ?? 0,
    output_tokens: usage.completion_tokens ?? 0,
    total_tokens: usage.total_tokens ?? 0,
  };
}

function mapFinishReason(reason: OpenAICompletionsFinishReason): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
    case "max_tokens":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool_use";
    case "content_filter":
      return "content_filter";
    default:
      return "stop";
  }
}

function buildUsageSnapshot(usage: OpenAICompletionsUsage): UsageMetadata {
  const inputTokenDetails = {
    ...(usage.prompt_tokens_details?.audio_tokens != null && {
      audio: usage.prompt_tokens_details.audio_tokens,
    }),
    ...(usage.prompt_tokens_details?.cached_tokens != null && {
      cache_read: usage.prompt_tokens_details.cached_tokens,
    }),
  };
  const outputTokenDetails = {
    ...(usage.completion_tokens_details?.audio_tokens != null && {
      audio: usage.completion_tokens_details.audio_tokens,
    }),
    ...(usage.completion_tokens_details?.reasoning_tokens != null && {
      reasoning: usage.completion_tokens_details.reasoning_tokens,
    }),
  };
  return {
    input_tokens: usage.prompt_tokens ?? 0,
    output_tokens: usage.completion_tokens ?? 0,
    total_tokens: usage.total_tokens ?? 0,
    ...(Object.keys(inputTokenDetails).length > 0 && {
      input_token_details: inputTokenDetails,
    }),
    ...(Object.keys(outputTokenDetails).length > 0 && {
      output_token_details: outputTokenDetails,
    }),
  };
}

function buildResponseMetadata(
  data: OpenAICompletionsStreamChunk,
  choice: OpenAICompletionsStreamChoice
): Record<string, unknown> {
  return {
    model_provider: "openai",
    model_name: data.model,
    system_fingerprint: data.system_fingerprint,
    service_tier: data.service_tier,
    finish_reason: choice.finish_reason,
    ...(data.usage ? { usage: data.usage } : {}),
  };
}
