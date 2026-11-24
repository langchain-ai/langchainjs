/**
 * Converts OpenRouter SSE stream chunks into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  convertOpenAICompletionsStream,
  type OpenAICompletionsStreamChunk,
} from "@langchain/core/language_models/openai_completions_stream";
import type { StreamingChunkData } from "../converters/messages.js";

export interface ConvertOpenRouterStreamOptions {
  streamUsage?: boolean;
}

export async function* convertOpenRouterStream(
  source: AsyncIterable<StreamingChunkData>,
  options: ConvertOpenRouterStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  // OpenRouter streams Chat Completions chunks, and the core converter reads
  // its `delta.reasoning` text directly (`reasoning_content ?? reasoning`).
  // OpenRouter's types are looser than core's (a null `reasoning`, open-ended
  // `finish_reason` values, null usage details), and the converter handles
  // each of those at runtime.
  yield* convertOpenAICompletionsStream(
    source as AsyncIterable<OpenAICompletionsStreamChunk>,
    { ...options, provider: "openrouter" }
  );
}
