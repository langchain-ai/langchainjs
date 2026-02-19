import {
  BaseMessage,
  BaseMessageChunk,
  UsageMetadata,
} from "@langchain/core/messages";
import {
  convertMessagesToCompletionsMessageParams,
  convertCompletionsMessageToBaseMessage,
  convertCompletionsDeltaToBaseMessageChunk,
} from "@langchain/openai";
import type { OpenAI as OpenAIClient } from "openai";
import type { OpenRouter } from "../api-types.js";

/**
 * The inner data shape of a streaming SSE chunk. Each parsed SSE event
 * contains this object directly (without the `data` wrapper that the
 * OpenAPI spec describes on `ChatStreamingResponseChunk`).
 */
export type StreamingChunkData = OpenRouter.ChatStreamingResponseChunk["data"];

// LangChain → OpenRouter
/**
 * Convert an array of LangChain messages to the OpenRouter request format.
 *
 * Delegates to the OpenAI completions converter since OpenRouter's chat
 * API is wire-compatible with OpenAI's. This gives us full support for
 * standard content blocks, reasoning-model developer role mapping,
 * multi-modal inputs, and all edge cases handled upstream.
 */
export function convertMessagesToOpenRouterParams(
  messages: BaseMessage[],
  model?: string
): OpenAIClient.Chat.Completions.ChatCompletionMessageParam[] {
  return convertMessagesToCompletionsMessageParams({
    messages,
    model,
  });
}

// OpenRouter → LangChain (non-streaming)
/**
 * Convert a non-streaming OpenRouter response choice into a BaseMessage.
 *
 * Delegates to the OpenAI completions converter for tool call parsing,
 * multi-modal output handling, and audio support, then patches
 * response_metadata to reflect the OpenRouter provider.
 */
export function convertOpenRouterResponseToBaseMessage(
  choice: OpenRouter.ChatResponseChoice,
  rawResponse: OpenRouter.ChatResponse
): BaseMessage {
  const message = convertCompletionsMessageToBaseMessage({
    message:
      choice.message as unknown as OpenAIClient.Chat.Completions.ChatCompletionMessage,
    rawResponse:
      rawResponse as unknown as OpenAIClient.Chat.Completions.ChatCompletion,
  });

  message.response_metadata = {
    ...message.response_metadata,
    model: rawResponse.model,
    model_provider: "openrouter",
    model_name: rawResponse.model,
    finish_reason: choice.finish_reason,
  };

  return message;
}

// OpenRouter → LangChain (streaming)
/**
 * Convert a streaming delta into a BaseMessageChunk.
 *
 * Delegates to the OpenAI completions converter for tool call chunk
 * parsing, audio handling, and role-specific message types, then
 * patches response_metadata to reflect the OpenRouter provider.
 */
export function convertOpenRouterDeltaToBaseMessageChunk(
  delta: OpenRouter.ChatStreamingMessageChunk,
  rawChunk: StreamingChunkData,
  defaultRole?: string
): BaseMessageChunk {
  const chunk = convertCompletionsDeltaToBaseMessageChunk({
    delta: delta as Record<string, unknown>,
    rawResponse:
      rawChunk as unknown as OpenAIClient.Chat.Completions.ChatCompletionChunk,
    defaultRole: (defaultRole ??
      "assistant") as OpenAIClient.Chat.ChatCompletionRole,
  });

  chunk.response_metadata = {
    ...chunk.response_metadata,
    model_provider: "openrouter",
  };

  return chunk;
}

// Usage metadata

/**
 * Convert OpenRouter usage info to LangChain's `UsageMetadata`,
 * including prompt/completion token detail breakdowns when available.
 */
export function convertUsageMetadata(
  usage?: OpenRouter.ChatGenerationTokenUsage
): UsageMetadata | undefined {
  if (!usage) return undefined;

  const result: UsageMetadata = {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
  };

  const promptDetails = usage.prompt_tokens_details;
  if (promptDetails) {
    const input_token_details: Record<string, number> = {};
    if (promptDetails.cached_tokens != null)
      input_token_details.cache_read = promptDetails.cached_tokens;
    if (promptDetails.audio_tokens != null)
      input_token_details.audio = promptDetails.audio_tokens;
    if (Object.keys(input_token_details).length > 0)
      result.input_token_details = input_token_details;
  }

  const completionDetails = usage.completion_tokens_details;
  if (completionDetails) {
    const output_token_details: Record<string, number> = {};
    if (completionDetails.reasoning_tokens != null)
      output_token_details.reasoning = completionDetails.reasoning_tokens;
    if (Object.keys(output_token_details).length > 0)
      result.output_token_details = output_token_details;
  }

  return result;
}
