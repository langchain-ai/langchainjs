import { describe, expect, test, vi, afterEach } from "vitest";
import { ChatCloudflareWorkersAI } from "../chat_models.js";

class MockStreamCloudflare extends ChatCloudflareWorkersAI {
  private readonly chunks: string[];

  constructor(chunks: string[]) {
    super({
      model: "@cf/meta/llama-2-7b-chat-int8",
      cloudflareAccountId: "fake-account",
      cloudflareApiToken: "fake-token",
      streaming: true,
    });
    this.chunks = chunks;
  }

  protected override async _request(
    _messages: unknown,
    _options: unknown,
    stream: boolean
  ): Promise<Response> {
    if (!stream) {
      throw new Error("Expected streaming request");
    }
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start: (controller) => {
          for (const chunk of this.chunks) {
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    );
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatCloudflareWorkersAI.streamV2", () => {
  test("streams text", async () => {
    const model = new MockStreamCloudflare([
      JSON.stringify({ response: "Hello" }),
      JSON.stringify({ response: " world" }),
    ]);
    await expect(model.streamV2("Hello")).toHaveStreamText("Hello world");
  });
});
