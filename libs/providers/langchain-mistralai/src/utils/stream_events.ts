/**
 * Converts Mistral chat stream chunks into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  convertOpenAICompletionsStream,
  type ConvertOpenAICompletionsStreamOptions,
  type OpenAICompletionsStreamChunk,
} from "@langchain/core/language_models/openai_completions_stream";

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export type MistralStreamData = Record<string, any>;

export interface ConvertMistralStreamOptions extends ConvertOpenAICompletionsStreamOptions {}

function mistralDataToOpenAIChunk(
  data: MistralStreamData
): OpenAICompletionsStreamChunk {
  const choice = data.choices?.[0];
  if (!choice) {
    return data as OpenAICompletionsStreamChunk;
  }

  const delta = choice.delta ?? {};
  const toolCalls = delta.toolCalls ?? delta.tool_calls;
  const mappedDelta = {
    ...delta,
    ...(toolCalls
      ? {
          tool_calls: toolCalls.map(
            (
              tc: {
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              },
              i: number
            ) => ({
              index: tc.index ?? i,
              id: tc.id,
              type: "function" as const,
              function: tc.function,
            })
          ),
        }
      : {}),
  };

  return {
    id: data.id ?? "",
    object: "chat.completion.chunk",
    created: data.created ?? 0,
    model: data.model ?? "",
    choices: [
      {
        index: choice.index ?? 0,
        delta: mappedDelta,
        finish_reason: choice.finish_reason ?? choice.finishReason ?? null,
        logprobs: choice.logprobs ?? null,
      },
    ],
    usage: data.usage ?? null,
    system_fingerprint: data.system_fingerprint ?? null,
  };
}

export async function* convertMistralStream(
  source: AsyncIterable<MistralStreamData>,
  options: ConvertMistralStreamOptions = {}
): AsyncGenerator<ChatModelStreamEvent> {
  async function* mapped() {
    for await (const data of source) {
      yield mistralDataToOpenAIChunk(data);
    }
  }
  yield* convertOpenAICompletionsStream(mapped(), {
    ...options,
    provider: options.provider ?? "mistralai",
  });
}
