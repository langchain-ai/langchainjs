import { describe, expect, test, vi, afterEach } from "vitest";
import type { GenerateContentRequest } from "@google/generative-ai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

type TestGoogleGenAIClient = {
  systemInstruction?: unknown;
  generateContentStream: (
    request: GenerateContentRequest,
    options?: unknown
  ) => Promise<{ stream: AsyncIterable<Record<string, unknown>> }>;
};

function getTestClient(model: ChatGoogleGenerativeAI): TestGoogleGenAIClient {
  return (model as unknown as { client: TestGoogleGenAIClient }).client;
}

function geminiTextStream() {
  return (async function* () {
    yield {
      candidates: [{ content: { parts: [{ text: "Hello" }] } }],
    };
    yield {
      candidates: [{ content: { parts: [{ text: " world" }] } }],
    };
  })();
}

function geminiReasoningStream() {
  return (async function* () {
    yield {
      candidates: [
        {
          content: {
            parts: [{ text: "Let me reason...", thought: true }],
          },
        },
      ],
    };
  })();
}

function geminiToolStream() {
  return (async function* () {
    yield {
      candidates: [
        {
          content: {
            parts: [{ text: "Let me search." }],
          },
        },
      ],
    };
    yield {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "web_search",
                  args: { query: "weather" },
                },
              },
            ],
          },
        },
      ],
    };
  })();
}

function geminiUsageStream() {
  return (async function* () {
    yield {
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 4,
        totalTokenCount: 14,
      },
      candidates: [{ content: { parts: [{ text: "Hi" }] } }],
    };
  })();
}

function mockGoogleGenAI(stream: AsyncIterable<Record<string, unknown>>) {
  const model = new ChatGoogleGenerativeAI({
    apiKey: "fake-key",
    model: "gemini-2.0-flash",
  });
  vi.spyOn(getTestClient(model), "generateContentStream").mockResolvedValue({
    stream,
  });
  return model;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatGoogleGenerativeAI.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockGoogleGenAI(geminiTextStream()).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockGoogleGenAI(geminiReasoningStream()).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockGoogleGenAI(geminiToolStream()).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("tool_call chunks carry an id (provided by the model or generated)", async () => {
    // Regression: previously the streaming path dropped `part.functionCall.id`
    // so the emitted `tool_call` content block had no `id`, which broke
    // downstream `ToolMessage.tool_call_id` matching in agent loops.
    const model = new ChatGoogleGenerativeAI({
      apiKey: "fake-key",
      model: "gemini-2.0-flash",
    });
    vi.spyOn(getTestClient(model), "generateContentStream").mockResolvedValue({
      stream: (async function* () {
        yield {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "echo",
                      args: { message: "hi" },
                      // No `id` field — simulates typical Gemini responses
                    },
                  },
                ],
              },
            },
          ],
        };
      })(),
    });

    const events: unknown[] = [];
    for await (const event of model.streamEvents("Hello")) {
      events.push(event);
    }

    const blockStart = events.find(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        (e as { event?: string }).event === "content-block-start"
    ) as
      | {
          event: "content-block-start";
          index: number;
          content?: { type?: string; id?: string; name?: string };
        }
      | undefined;
    expect(blockStart).toBeDefined();
    expect(blockStart?.content?.type).toBe("tool_call_chunk");
    expect(blockStart?.content?.name).toBe("echo");
    expect(typeof blockStart?.content?.id).toBe("string");
    expect((blockStart?.content?.id ?? "").length).toBeGreaterThan(0);

    const blockFinish = events.find(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        (e as { event?: string }).event === "content-block-finish"
    ) as
      | {
          event: "content-block-finish";
          content?: { type?: string; id?: string; name?: string; args?: unknown };
        }
      | undefined;
    expect(blockFinish?.content?.type).toBe("tool_call");
    expect(blockFinish?.content?.id).toBe(blockStart?.content?.id);
    expect(blockFinish?.content?.name).toBe("echo");
    expect(blockFinish?.content?.args).toEqual({ message: "hi" });
  });

  test("tool_call chunks preserve a model-provided id when present", async () => {
    const model = new ChatGoogleGenerativeAI({
      apiKey: "fake-key",
      model: "gemini-2.0-flash",
    });
    vi.spyOn(getTestClient(model), "generateContentStream").mockResolvedValue({
      stream: (async function* () {
        yield {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "echo",
                      args: { message: "hi" },
                      id: "google-provided-id-123",
                    },
                  },
                ],
              },
            },
          ],
        };
      })(),
    });

    const events: unknown[] = [];
    for await (const event of model.streamEvents("Hello")) {
      events.push(event);
    }

    const blockStart = events.find(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        (e as { event?: string }).event === "content-block-start"
    ) as { content?: { id?: string } } | undefined;
    expect(blockStart?.content?.id).toBe("google-provided-id-123");

    const blockFinish = events.find(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        (e as { event?: string }).event === "content-block-finish"
    ) as { content?: { id?: string } } | undefined;
    expect(blockFinish?.content?.id).toBe("google-provided-id-123");
  });

  test("streams usage", async () => {
    await expect(
      mockGoogleGenAI(geminiUsageStream()).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 4,
      total_tokens: 14,
    });
  });

  test("passes system instructions per streamEvents request", async () => {
    const model = new ChatGoogleGenerativeAI({
      apiKey: "fake-key",
      model: "gemini-2.0-flash",
    });
    const generateContentStream = vi
      .spyOn(getTestClient(model), "generateContentStream")
      .mockResolvedValue({
        stream: geminiTextStream(),
      });

    await expect(
      model.streamEvents([
        new SystemMessage("StreamV2 system instruction"),
        new HumanMessage("Hello"),
      ])
    ).toHaveStreamText("Hello world");

    const [[request]] = generateContentStream.mock.calls;
    expect(request.systemInstruction).toEqual({
      role: "system",
      parts: [{ text: "StreamV2 system instruction" }],
    });
    expect(request.contents).toEqual([
      { role: "user", parts: [{ text: "Hello" }] },
    ]);
    expect(getTestClient(model).systemInstruction).toBeUndefined();
  });

  test("passes system instructions per stream request", async () => {
    const model = new ChatGoogleGenerativeAI({
      apiKey: "fake-key",
      model: "gemini-2.0-flash",
    });
    const generateContentStream = vi
      .spyOn(getTestClient(model), "generateContentStream")
      .mockResolvedValue({
        stream: geminiTextStream(),
      });

    const stream = await model.stream([
      new SystemMessage("Stream system instruction"),
      new HumanMessage("Hello"),
    ]);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk.text);
    }

    const [[request]] = generateContentStream.mock.calls;
    expect(chunks.join("")).toBe("Hello world");
    expect(request.systemInstruction).toEqual({
      role: "system",
      parts: [{ text: "Stream system instruction" }],
    });
    expect(request.contents).toEqual([
      { role: "user", parts: [{ text: "Hello" }] },
    ]);
    expect(getTestClient(model).systemInstruction).toBeUndefined();
  });
});
