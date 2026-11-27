import { describe, expect, test } from "vitest";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { ApiClient } from "../../clients/index.js";
import { RequestError } from "../../utils/errors.js";
import { ChatGoogle } from "../index.js";
import type { Gemini } from "../types.js";

/**
 * Answers each request with the next response in the list, and the last one
 * for every request after that.
 */
class SequencedApiClient extends ApiClient {
  calls = 0;

  constructor(private readonly responses: Array<() => Response>) {
    super();
  }

  async fetch(): Promise<Response> {
    const next =
      this.responses[Math.min(this.calls, this.responses.length - 1)];
    this.calls += 1;
    return next();
  }

  hasApiKey(): boolean {
    return true;
  }
}

const textChunks: Gemini.GenerateContentResponse[] = [
  { candidates: [{ content: { parts: [{ text: "Hello" }] } }] },
  { candidates: [{ content: { parts: [{ text: " world" }] } }] },
];

const streamed = (chunks: Gemini.GenerateContentResponse[]) => () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
};

const overloaded = () =>
  new Response(
    JSON.stringify({
      error: { code: 503, message: "The model is overloaded." },
    }),
    { status: 503, statusText: "Service Unavailable" }
  );

const quotaExceeded = () =>
  new Response(JSON.stringify({ error: { message: "Usage quota exceeded" } }), {
    status: 429,
    statusText: "Too Many Requests",
    headers: { "retry-after": "120" },
  });

async function consume(stream: AsyncIterable<unknown>): Promise<void> {
  for await (const _event of stream) {
    // drain the stream so the request and any retries complete
  }
}

// streamEvents() (and invoke() when a callback handler consumes stream events)
// goes through the handlers' streamChatModelEvents(), which should retry a
// failed request through the model's caller as generate() and
// streamResponseChunks() do.
describe("ChatGoogle.streamEvents retries", () => {
  test("retries a failed request before the stream starts", async () => {
    const apiClient = new SequencedApiClient([
      overloaded,
      streamed(textChunks),
    ]);
    const llm = new ChatGoogle({
      model: "gemini-2.0-flash",
      apiKey: "fake-key",
      apiClient,
      maxRetries: 1,
    });

    await expect(llm.streamEvents("Hello")).toHaveStreamText("Hello world");
    expect(apiClient.calls).toBe(2);
  });

  test("retries in invoke() when a handler consumes stream events", async () => {
    // A handler that prefers chat-model stream events takes invoke() onto the
    // event path.
    class StreamEventsHandler extends BaseCallbackHandler {
      name = "stream-events-handler";

      lc_prefer_chat_model_stream_events = true;

      events = 0;

      async handleChatModelStreamEvent() {
        this.events += 1;
      }
    }
    const handler = new StreamEventsHandler();
    const apiClient = new SequencedApiClient([
      overloaded,
      streamed(textChunks),
    ]);
    const llm = new ChatGoogle({
      model: "gemini-2.0-flash",
      apiKey: "fake-key",
      apiClient,
      maxRetries: 1,
    });

    const message = await llm.invoke("Hello", { callbacks: [handler] });
    expect(message.text).toBe("Hello world");
    expect(handler.events).toBeGreaterThan(0);
    expect(apiClient.calls).toBe(2);
  });

  test("gives up after maxRetries", async () => {
    const apiClient = new SequencedApiClient([overloaded]);
    const llm = new ChatGoogle({
      model: "gemini-2.0-flash",
      apiKey: "fake-key",
      apiClient,
      maxRetries: 1,
    });

    await expect(consume(llm.streamEvents("Hello"))).rejects.toBeInstanceOf(
      RequestError
    );
    expect(apiClient.calls).toBe(2);
  });

  test("does not retry quota-style 429 responses", async () => {
    const apiClient = new SequencedApiClient([quotaExceeded]);
    const llm = new ChatGoogle({
      model: "gemini-2.0-flash",
      apiKey: "fake-key",
      apiClient,
      maxRetries: 3,
    });

    await expect(consume(llm.streamEvents("Hello"))).rejects.toMatchObject({
      name: "RequestError",
      rateLimitType: "stop",
    });
    expect(apiClient.calls).toBe(1);
  });

  test("interactions handler: retries, then gives up after maxRetries", async () => {
    const apiClient = new SequencedApiClient([overloaded]);
    const llm = new ChatGoogle({
      model: "gemini-2.0-flash",
      apiKey: "fake-key",
      apiClient,
      apiHandler: "interactions",
      maxRetries: 1,
    });

    await expect(consume(llm.streamEvents("Hello"))).rejects.toBeInstanceOf(
      RequestError
    );
    expect(apiClient.calls).toBe(2);
  });
});
