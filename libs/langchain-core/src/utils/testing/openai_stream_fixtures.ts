import type { OpenAICompletionsStreamChunk } from "../../language_models/openai_completions_stream.js";

export function asAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

export function openAITextOnlyChunksWithUsage(
  model = "test-model"
): OpenAICompletionsStreamChunk[] {
  const chunks = openAITextOnlyChunks(model);
  const last = chunks[chunks.length - 1]!;
  chunks[chunks.length - 1] = {
    ...last,
    usage: {
      prompt_tokens: 10,
      completion_tokens: 2,
      total_tokens: 12,
    },
  };
  return chunks;
}

export function openAITextOnlyChunks(
  model = "test-model"
): OpenAICompletionsStreamChunk[] {
  return [
    {
      id: "chatcmpl-text",
      model,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Hello" },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-text",
      model,
      choices: [
        {
          index: 0,
          delta: { content: " world" },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-text",
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    },
  ];
}

export function openAIReasoningTextChunks(
  model = "test-model"
): OpenAICompletionsStreamChunk[] {
  return [
    {
      id: "chatcmpl-reason",
      model,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", reasoning_content: "Let me reason..." },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-reason",
      model,
      choices: [
        {
          index: 0,
          delta: { content: "Answer." },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-reason",
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    },
  ];
}

export function openAIToolCallChunks(
  model = "test-model"
): OpenAICompletionsStreamChunk[] {
  return [
    {
      id: "chatcmpl-tools",
      model,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Let me search." },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-tools",
      model,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_abc",
                type: "function",
                function: { name: "web_search", arguments: '{"query"' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-tools",
      model,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { arguments: ':"weather"}' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      id: "chatcmpl-tools",
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
    },
  ];
}

export function sseResponseFromOpenAIChunks(
  chunks: OpenAICompletionsStreamChunk[]
): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
          );
        }
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } }
  );
}
