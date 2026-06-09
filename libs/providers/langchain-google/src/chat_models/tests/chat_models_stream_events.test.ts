import { describe, expect, test } from "vitest";
import { ApiClient } from "../../clients/index.js";
import { ChatGoogle } from "../index.js";
import type { Gemini } from "../api-types.js";

class MockChunkStreamingResponse implements Response {
  readonly headers = new Headers();
  readonly ok = true;
  readonly redirected = false;
  readonly status = 200;
  readonly statusText = "OK";
  readonly type: ResponseType = "basic";
  readonly url = "http://localhost";
  readonly bodyUsed = false;
  readonly body: ReadableStream<Uint8Array<ArrayBuffer>>;

  constructor(chunks: Gemini.GenerateContentResponse[]) {
    const encoder = new TextEncoder();
    this.body = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
          );
        }
        controller.close();
      },
    });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    throw new Error("Not implemented");
  }
  async blob(): Promise<Blob> {
    throw new Error("Not implemented");
  }
  async formData(): Promise<FormData> {
    throw new Error("Not implemented");
  }
  async json(): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async text(): Promise<string> {
    throw new Error("Not implemented");
  }
  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    throw new Error("Not implemented");
  }
  clone(): Response {
    throw new Error("Not implemented");
  }
}

class MockStreamingApiClient extends ApiClient {
  constructor(private readonly chunks: Gemini.GenerateContentResponse[]) {
    super();
  }

  async fetch(): Promise<Response> {
    return new MockChunkStreamingResponse(this.chunks);
  }

  hasApiKey(): boolean {
    return true;
  }
}

const textChunks: Gemini.GenerateContentResponse[] = [
  { candidates: [{ content: { parts: [{ text: "Hello" }] } }] },
  { candidates: [{ content: { parts: [{ text: " world" }] } }] },
];

const reasoningChunks: Gemini.GenerateContentResponse[] = [
  {
    candidates: [
      {
        content: {
          parts: [{ text: "Let me reason...", thought: true }],
        },
      },
    ],
  },
];

const toolChunks: Gemini.GenerateContentResponse[] = [
  { candidates: [{ content: { parts: [{ text: "Let me search." }] } }] },
  {
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
  },
];

const usageChunks: Gemini.GenerateContentResponse[] = [
  {
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 4,
      totalTokenCount: 14,
    },
    candidates: [{ content: { parts: [{ text: "Hi" }] } }],
  },
];

function mockChatGoogle(chunks: Gemini.GenerateContentResponse[]) {
  return new ChatGoogle({
    model: "gemini-2.0-flash",
    apiKey: "fake-key",
    apiClient: new MockStreamingApiClient(chunks),
  });
}

describe("ChatGoogle.streamV2", () => {
  test("streams text", async () => {
    await expect(mockChatGoogle(textChunks).streamV2("Hello")).toHaveStreamText(
      "Hello world"
    );
  });

  test("streams reasoning", async () => {
    await expect(
      mockChatGoogle(reasoningChunks).streamV2("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockChatGoogle(toolChunks).streamV2("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockChatGoogle(usageChunks).streamV2("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 4,
      total_tokens: 14,
    });
  });
});
