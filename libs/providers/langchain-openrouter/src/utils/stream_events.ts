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

function mapOpenRouterChunkToOpenAI(
  data: StreamingChunkData
): OpenAICompletionsStreamChunk {
  const choice = data.choices?.[0];
  if (
    choice?.delta &&
    typeof choice.delta.reasoning === "string" &&
    choice.delta.reasoning_content == null
  ) {
    return {
      ...(data as unknown as OpenAICompletionsStreamChunk),
      choices: [
        {
          ...choice,
          delta: {
            ...choice.delta,
            reasoning_content: choice.delta.reasoning,
          },
        },
      ],
    };
  }
  return data as unknown as OpenAICompletionsStreamChunk;
}

export async function* convertOpenRouterStream(
  source: AsyncIterable<StreamingChunkData>,
  options: ConvertOpenRouterStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  async function* mapped() {
    for await (const chunk of source) {
      yield mapOpenRouterChunkToOpenAI(chunk);
    }
  }
  yield* convertOpenAICompletionsStream(mapped(), {
    ...options,
    provider: "openrouter",
  });
}
