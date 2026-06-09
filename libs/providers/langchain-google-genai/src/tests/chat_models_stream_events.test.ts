import { describe, expect, test, vi, afterEach } from "vitest";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

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

function mockGoogleGenAI(stream: AsyncIterable<Record<string, unknown>>) {
  const model = new ChatGoogleGenerativeAI({
    apiKey: "fake-key",
    model: "gemini-2.0-flash",
  });
  vi.spyOn(model.client, "generateContentStream").mockResolvedValue({
    stream,
  } as never);
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
});
