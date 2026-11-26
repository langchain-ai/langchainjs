import { afterEach, describe, expect, test, vi } from "vitest";
import { concat } from "@langchain/core/utils/stream";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatXAI } from "../completions.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const usage = {
  prompt_tokens: 14,
  completion_tokens: 49,
  total_tokens: 263,
  prompt_tokens_details: { cached_tokens: 3, audio_tokens: 0 },
  completion_tokens_details: { reasoning_tokens: 200, audio_tokens: 0 },
};

const expectedUsage = {
  input_tokens: 14,
  output_tokens: 49,
  total_tokens: 263,
  input_token_details: { cache_read: 3, audio: 0 },
  output_token_details: { reasoning: 200, audio: 0 },
};

describe.each(["finish chunk", "separate chunk"] as const)(
  "ChatXAI streaming usage in %s",
  (usageLocation) => {
    function createModel() {
      const base = {
        id: "test-completion",
        object: "chat.completion.chunk",
        created: 0,
        model: "grok-3-mini-fast",
      };
      const chunks = [
        {
          ...base,
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Paris" },
              finish_reason: null,
            },
          ],
        },
        {
          ...base,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          ...(usageLocation === "finish chunk" ? { usage } : {}),
        },
        ...(usageLocation === "separate chunk"
          ? [{ ...base, choices: [], usage }]
          : []),
      ];
      const body = `${chunks
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join("")}data: [DONE]\n\n`;
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(body, {
          headers: { "content-type": "text/event-stream" },
        })
      );
      return new ChatXAI({
        apiKey: "fake-key",
        model: "grok-3-mini-fast",
        streaming: true,
        maxRetries: 0,
      });
    }

    test("invoke returns normalized token counts", async () => {
      const result = await createModel().invoke(
        "What is the capital of France?"
      );
      expect(result.content).toBe("Paris");
      expect(result.usage_metadata).toEqual(expectedUsage);
    });

    test("stream emits usage once and preserves it when concatenated", async () => {
      const stream = await createModel().stream(
        "What is the capital of France?"
      );
      const chunks: AIMessageChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(
        chunks.filter((chunk) => chunk.usage_metadata !== undefined)
      ).toHaveLength(1);
      const result = chunks.reduce((left, right) => concat(left, right));
      expect(result.content).toBe("Paris");
      expect(result.usage_metadata).toEqual(expectedUsage);
    });

    test("streamEvents returns normalized token counts", async () => {
      const events = createModel().streamEvents(
        "What is the capital of France?",
        {
          version: "v2",
        }
      );
      const outputs: AIMessageChunk[] = [];
      for await (const event of events) {
        if (event.event === "on_chat_model_end") {
          outputs.push(event.data.output);
        }
      }
      expect(outputs).toHaveLength(1);
      expect(outputs[0].content).toBe("Paris");
      expect(outputs[0].usage_metadata).toEqual(expectedUsage);
    });
  }
);
