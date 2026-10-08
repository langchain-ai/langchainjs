import { describe, expect, test } from "vitest";
import { ApiClient } from "../../clients/index.js";
import { ChatGoogle } from "../index.js";
import type { Gemini } from "../api-types.js";
import {
  GoogleRequestRecorder,
  GoogleRequestLogger,
} from "../../utils/handler.js";

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

describe("ChatGoogle.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockChatGoogle(textChunks).streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockChatGoogle(reasoningChunks).streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockChatGoogle(toolChunks).streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });

  test("streams usage", async () => {
    await expect(
      mockChatGoogle(usageChunks).streamEvents("Hello")
    ).toHaveStreamUsage({
      input_tokens: 10,
      output_tokens: 4,
      total_tokens: 14,
    });
  });

  test("yields request, response, and chunk provider events in stream", async () => {
    const model = mockChatGoogle(textChunks);
    const stream = model.streamEvents("Hello");
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    const providerEvents = events.filter((e) => e.event === "provider");
    expect(providerEvents.length).toBeGreaterThanOrEqual(3);

    const requestEvent = providerEvents.find((e) => e.name === "request");
    expect(requestEvent).toBeDefined();
    expect(requestEvent?.provider).toBe("google");
    expect(
      (requestEvent?.payload as { url: string; body: unknown }).url
    ).toContain("streamGenerateContent");
    expect(
      (requestEvent?.payload as { url: string; body: unknown }).body
    ).toBeDefined();

    const responseEvent = providerEvents.find((e) => e.name === "response");
    expect(responseEvent).toBeDefined();
    expect(responseEvent?.provider).toBe("google");
    expect((responseEvent?.payload as { status: number }).status).toBe(200);

    const chunkEvents = providerEvents.filter((e) => e.name === "chunk");
    expect(chunkEvents).toHaveLength(2);
    expect(
      (chunkEvents[0].payload as { chunk: Gemini.GenerateContentResponse })
        .chunk
    ).toBeDefined();
  });

  test("populates GoogleRequestRecorder passed in model callbacks", async () => {
    const recorder = new GoogleRequestRecorder();
    const model = new ChatGoogle({
      model: "gemini-2.0-flash",
      apiKey: "fake-key",
      apiClient: new MockStreamingApiClient(textChunks),
      callbacks: [recorder],
    });

    const stream = model.streamEvents("Hello");
    for await (const _ of stream) {
      // consume stream
    }

    expect(recorder.request.url).toContain("streamGenerateContent");
    expect(recorder.request.body).toBeDefined();
    expect(recorder.response.status).toBe(200);
    expect(recorder.chunk).toHaveLength(2);
    expect(recorder.chunks).toHaveLength(2);
    expect(recorder.requests).toHaveLength(1);
    expect(recorder.responses).toHaveLength(1);

    recorder.reset();
    expect(recorder.chunk).toHaveLength(0);
    expect(recorder.request).toEqual({});
  });

  test("records stream events using recorder.tap()", async () => {
    const recorder = new GoogleRequestRecorder();
    const model = mockChatGoogle(textChunks);
    const stream = model.streamEvents("Hello");

    const collectedEvents = [];
    for await (const event of recorder.tap(stream)) {
      collectedEvents.push(event);
    }

    expect(collectedEvents.length).toBeGreaterThan(0);
    expect(recorder.request.url).toBeDefined();
    expect(recorder.response.status).toBe(200);
    expect(recorder.chunk).toHaveLength(2);
  });

  test("records error response event on fetch failure", async () => {
    const recorder = new GoogleRequestRecorder();
    class FailingApiClient extends MockStreamingApiClient {
      constructor() {
        super([]);
      }
      override async fetch(): Promise<Response> {
        throw new Error("Simulated network failure");
      }
    }
    const failingApiClient = new FailingApiClient();

    const model = new ChatGoogle({
      model: "gemini-3.7-flash",
      apiKey: "fake-key",
      apiClient: failingApiClient,
      callbacks: [recorder],
      maxRetries: 0,
    });

    await expect(async () => {
      const stream = model.streamEvents("Hello");
      for await (const _ of stream) {
        // consume
      }
    }).rejects.toThrow("Simulated network failure");

    expect(recorder.response.error).toBeDefined();
  });

  test("runs with GoogleRequestLogger without error", async () => {
    const logger = new GoogleRequestLogger();
    const model = new ChatGoogle({
      model: "gemini-3.7-flash",
      apiKey: "fake-key",
      apiClient: new MockStreamingApiClient(textChunks),
      callbacks: [logger],
    });

    const stream = model.streamEvents("Hello");
    for await (const _ of stream) {
      // consume
    }
  });
});
