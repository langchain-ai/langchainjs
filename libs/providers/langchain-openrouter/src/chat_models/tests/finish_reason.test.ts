import { afterEach, describe, expect, test, vi } from "vitest";
import type { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenRouter } from "../index.js";

function completionResponse(finishReason: string | null) {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-1",
      model: "openai/gpt-4o-mini",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hi" },
          finish_reason: finishReason,
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function streamResponse(finishReason: string) {
  const chunks = [
    {
      id: "chatcmpl-1",
      model: "openai/gpt-4o-mini",
      choices: [{ index: 0, delta: { content: "Hi" }, finish_reason: null }],
    },
    {
      id: "chatcmpl-1",
      model: "openai/gpt-4o-mini",
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
    },
  ];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function makeModel() {
  return new ChatOpenRouter({
    model: "openai/gpt-4o-mini",
    apiKey: "fake-key",
    streamUsage: false,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChatOpenRouter finish reason", () => {
  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["tool_calls", "tool_call"],
    ["content_filter", "content_filter"],
    ["error", "error"],
    ["something_new", "other"],
  ])("invoke maps %s to %s", async (raw, normalized) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(completionResponse(raw));
    const result = await makeModel().invoke("Hello");
    expect(result.response_metadata.finish_reason).toBe(raw);
    expect(result.response_metadata.normalized_finish_reason).toBe(normalized);
  });

  test("invoke sets no normalized reason without a finish reason", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(completionResponse(null));
    const result = await makeModel().invoke("Hello");
    expect(result.response_metadata.finish_reason).toBeNull();
    expect(result.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("legacy stream sets it on the finish chunk only", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse("length"));
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await makeModel().stream("Hello")) {
      chunks.push(chunk);
    }
    const withReason = chunks.filter(
      (c) => c.response_metadata.normalized_finish_reason !== undefined
    );
    expect(withReason).toHaveLength(1);
    expect(withReason[0].response_metadata.finish_reason).toBe("length");
    expect(withReason[0].response_metadata.normalized_finish_reason).toBe(
      "length"
    );
  });
});
