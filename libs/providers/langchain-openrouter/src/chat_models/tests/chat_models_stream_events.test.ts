import { describe, expect, test, vi, afterEach } from "vitest";
import {
  openAIReasoningTextChunks,
  openAITextOnlyChunks,
  openAITextOnlyChunksWithUsage,
  openAIToolCallChunks,
  sseResponseFromOpenAIChunks,
} from "@langchain/core/testing";
import { ChatOpenRouter } from "../index.js";

function mockOpenRouter(chunks: ReturnType<typeof openAITextOnlyChunks>) {
  const model = new ChatOpenRouter({
    apiKey: "fake-key",
    model: "openai/gpt-4o-mini",
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    sseResponseFromOpenAIChunks(chunks)
  );
  return model;
}

function openRouterReasoningChunks(): ReturnType<typeof openAITextOnlyChunks> {
  return [
    {
      id: "gen-1",
      model: "openai/gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", reasoning: "thinking..." },
          finish_reason: null,
        },
      ],
    },
    {
      id: "gen-1",
      model: "openai/gpt-4o-mini",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    },
  ] as unknown as ReturnType<typeof openAITextOnlyChunks>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatOpenRouter.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockOpenRouter(openAITextOnlyChunks()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockOpenRouter(openAIReasoningTextChunks()).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams OpenRouter reasoning field", async () => {
    await expect(
      mockOpenRouter(openRouterReasoningChunks()).streamEvents("Hello")
    ).toHaveStreamReasoning("thinking...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockOpenRouter(openAIToolCallChunks()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockOpenRouter(openAITextOnlyChunksWithUsage()).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 2,
      total_tokens: 12,
    });
  });
});

describe.each(["stream", "streamEvents"] as const)(
  "%s provider errors",
  (method) => {
    test.each([false, true])(
      "throws an SSE error after partial output=%s",
      async (partial) => {
        const model = new ChatOpenRouter({
          apiKey: "fake-key",
          model: "test",
          maxRetries: 0,
        });
        const events: unknown[] = partial
          ? [
              {
                id: "test",
                choices: [
                  { index: 0, delta: { role: "assistant", content: "Hello" } },
                ],
              },
            ]
          : [];
        events.push({
          id: "test",
          error: {
            code: "server_error",
            message: "Provider disconnected",
            metadata: { provider_name: "test-provider" },
          },
          choices: [
            { index: 0, delta: { content: "" }, finish_reason: "error" },
          ],
        });
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response(
            `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`,
            { headers: { "Content-Type": "text/event-stream" } }
          )
        );
        async function consume() {
          const stream =
            method === "stream"
              ? await model.stream("Hello")
              : model.streamEvents("Hello");
          for await (const _chunk of stream) {
            /* consume the complete stream */
          }
        }
        await expect(consume()).rejects.toMatchObject({
          name: "OpenRouterError",
          message: "Provider disconnected",
          code: "server_error",
          metadata: { provider_name: "test-provider" },
        });
      }
    );
  }
);
