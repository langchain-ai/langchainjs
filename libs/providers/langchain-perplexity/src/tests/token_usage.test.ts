import { afterEach, describe, expect, test, vi } from "vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { asAsyncIterable } from "@langchain/core/testing";
import type OpenAI from "openai";
import { ChatPerplexity } from "../chat_models.js";

const usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 };
const expectedUsage = { input_tokens: 10, output_tokens: 20, total_tokens: 30 };
const base = { id: "test", created: 0, model: "sonar" };

afterEach(() => vi.restoreAllMocks());

describe("ChatPerplexity token usage", () => {
  test.each([usage, undefined])(
    "invoke exposes supplied usage: %j",
    async (tokens) => {
      const model = new ChatPerplexity({ apiKey: "test-key", model: "sonar" });
      vi.spyOn(model.client.chat.completions, "create").mockResolvedValue({
        ...base,
        object: "chat.completion",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            logprobs: null,
            message: { role: "assistant", content: "Hello", refusal: null },
          },
        ],
        usage: tokens,
      });
      const result = await model.invoke("Hi");
      expect(result.content).toBe("Hello");
      expect(result.usage_metadata).toEqual(tokens ? expectedUsage : undefined);
    }
  );

  test.each(["empty delta", "empty choices", "text", "cumulative"] as const)(
    "stream preserves usage from %s chunks without double counting",
    async (kind) => {
      const model = new ChatPerplexity({ apiKey: "test-key", model: "sonar" });
      const chunks: OpenAI.Chat.Completions.ChatCompletionChunk[] = [
        {
          ...base,
          object: "chat.completion.chunk",
          choices: [
            {
              index: 0,
              finish_reason: null,
              delta: { role: "assistant", content: "Hello" },
            },
          ],
          usage:
            kind === "cumulative"
              ? { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 }
              : undefined,
        },
        {
          ...base,
          object: "chat.completion.chunk",
          choices:
            kind === "empty choices"
              ? []
              : [
                  {
                    index: 0,
                    finish_reason: "stop",
                    delta: {
                      role: "assistant",
                      content: kind === "text" ? " world" : "",
                    },
                  },
                ],
          usage,
        },
      ];
      vi.spyOn(model.client.chat.completions, "create").mockResolvedValue(
        asAsyncIterable(chunks) as never
      );
      let result = new AIMessageChunk("");
      for await (const chunk of await model.stream("Hi")) {
        result = result.concat(chunk);
      }
      expect(result.content).toBe(kind === "text" ? "Hello world" : "Hello");
      expect(result.usage_metadata).toMatchObject(expectedUsage);
    }
  );
});
