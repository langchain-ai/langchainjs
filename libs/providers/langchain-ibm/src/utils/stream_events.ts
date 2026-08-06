/**
 * Converts IBM watsonx chat stream chunks into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  convertOpenAICompletionsStream,
  type OpenAICompletionsStreamChunk,
} from "@langchain/core/language_models/openai_completions_stream";

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export type WatsonxStreamWrapper = { data: Record<string, any> };

export interface ConvertWatsonxStreamOptions {
  streamUsage?: boolean;
}

function watsonxWrapperToOpenAIChunk(
  wrapper: WatsonxStreamWrapper
): OpenAICompletionsStreamChunk {
  const data = wrapper.data;
  const choice = data.choices?.[0];
  const delta = choice?.delta ?? {};
  const usage = data.usage;
  return {
    id: data.id ?? "",
    object: "chat.completion.chunk",
    created: data.created ?? 0,
    model: data.model ?? "",
    choices: choice
      ? [
          {
            index: choice.index ?? 0,
            delta: {
              ...delta,
              ...(delta.reasoning != null && delta.reasoning_content == null
                ? { reasoning_content: delta.reasoning }
                : {}),
            },
            finish_reason: choice.finish_reason ?? null,
            logprobs: null,
          },
        ]
      : [],
    usage: usage
      ? {
          prompt_tokens: usage.prompt_tokens ?? 0,
          completion_tokens: usage.completion_tokens ?? 0,
          total_tokens: usage.total_tokens ?? 0,
        }
      : null,
    system_fingerprint: null,
  };
}

export async function* convertWatsonxStream(
  source: AsyncIterable<WatsonxStreamWrapper>,
  options: ConvertWatsonxStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  async function* mapped() {
    for await (const chunk of source) {
      yield watsonxWrapperToOpenAIChunk(chunk);
    }
  }
  yield* convertOpenAICompletionsStream(mapped(), {
    ...options,
    provider: "ibm",
  });
}
