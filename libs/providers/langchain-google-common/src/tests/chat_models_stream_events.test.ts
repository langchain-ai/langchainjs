import { describe, expect, test } from "vitest";
import { TestChatGoogle } from "./test_chat_google.js";

function mockChatGoogle(resultFile: string) {
  return new TestChatGoogle({
    model: "gemini-2.0-flash",
    authOptions: {
      record: {},
      projectId: "test-project",
      resultFile,
    },
  });
}

describe("ChatGoogle.streamEvents", () => {
  test("streams text", async () => {
    await expect(
      mockChatGoogle("chat-stream-usage-cache-mock.json").streamEvents("Hello")
    ).toHaveStreamText("Hello world");
  });

  test("streams reasoning", async () => {
    await expect(
      mockChatGoogle("chat-stream-thinking-mock.json").streamEvents("Hello")
    ).toHaveStreamReasoning("Let me reason...");
  });

  test("streams tool calls", async () => {
    await expect(
      mockChatGoogle("chat-stream-tool-mock.json").streamEvents("Hello")
    ).toHaveStreamToolCalls([
      { name: "web_search", args: { query: "weather" } },
    ]);
  });
});
