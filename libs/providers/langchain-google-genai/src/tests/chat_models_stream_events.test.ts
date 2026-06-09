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

describe("ChatGoogleGenerativeAI.streamV2", () => {
  test("streams text", async () => {
    await expect(
      mockGoogleGenAI(geminiTextStream()).streamV2("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockGoogleGenAI(geminiReasoningStream()).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockGoogleGenAI(geminiToolStream()).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockGoogleGenAI(geminiUsageStream()).streamV2("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 4,
      total_tokens: 14,
    });
  });

  test("passes system instructions per streamV2 request", async () => {
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
      model.streamV2([
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
