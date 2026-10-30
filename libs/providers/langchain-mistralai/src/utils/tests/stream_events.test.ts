import { describe, expect, test, vi } from "vitest";
import { ChatMistralAI } from "../../chat_models.js";

function mockMistral(chunks: Record<string, unknown>[]) {
  const model = new ChatMistralAI({
    apiKey: "fake-key",
    model: "mistral-small",
    streaming: true,
  });
  vi.spyOn(model, "completionWithRetry").mockResolvedValue({
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield { data: chunk };
      }
    },
  } as never);
  return model;
}

describe("ChatMistralAI.streamEvents", () => {
  test("maps camelCase toolCalls to OpenAI shape", async () => {
    await expect(
      mockMistral([
        {
          id: "cmpl-1",
          object: "chat.completion.chunk",
          created: 0,
          model: "mistral-small",
          choices: [
            {
              index: 0,
              delta: {
                role: "assistant",
                toolCalls: [
                  {
                    index: 0,
                    id: "call_1",
                    type: "function",
                    function: { name: "get_weather", arguments: '{"loc":' },
                  },
                ],
              },
              finishReason: null,
            },
          ],
        },
        {
          id: "cmpl-1",
          object: "chat.completion.chunk",
          created: 0,
          model: "mistral-small",
          choices: [
            {
              index: 0,
              delta: {
                toolCalls: [
                  {
                    index: 0,
                    type: "function",
                    function: { arguments: '"NYC"}' },
                  },
                ],
              },
              finishReason: "tool_calls",
            },
          ],
        },
      ]).streamEvents("Hello")
    ).toHaveStreamToolCalls([{ name: "get_weather", args: { loc: "NYC" } }]);
  });

  test("text-only streaming", async () => {
    await expect(
      mockMistral([
        {
          choices: [{ index: 0, delta: { content: "Hi" }, finishReason: null }],
        },
        {
          choices: [{ index: 0, delta: {}, finishReason: "stop" }],
        },
      ]).streamEvents("Hello")
    ).toHaveStreamText("Hi");
  });
});
