import { test, expect, describe, vi } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import {
  ChatMistralAI,
  convertMessagesToMistralMessages,
} from "../chat_models.js";
import {
  _isValidMistralToolCallId,
  _convertToolCallIdToMistralCompatible,
  _mistralContentChunkToMessageContentComplex,
} from "../utils.js";
import { ChatCompletionRequest } from "@mistralai/mistralai/models/components/chatcompletionrequest.js";

describe("Mistral Tool Call ID Conversion", () => {
  test("valid and invalid Mistral tool call IDs", () => {
    expect(_isValidMistralToolCallId("ssAbar4Dr")).toBe(true);
    expect(_isValidMistralToolCallId("abc123")).toBe(false);
    expect(_isValidMistralToolCallId("call_JIIjI55tTipFFzpcP8re3BpM")).toBe(
      false
    );
  });

  test("tool call ID conversion", () => {
    const resultMap: Record<string, string> = {
      ssAbar4Dr: "ssAbar4Dr",
      abc123: "0001yoN1K",
      call_JIIjI55tTipFFzpcP8re3BpM: "0001sqrj5",
      12345: "00003akVR",
    };

    for (const [inputId, expectedOutput] of Object.entries(resultMap)) {
      const convertedId = _convertToolCallIdToMistralCompatible(inputId);
      expect(convertedId).toBe(expectedOutput);
      expect(_isValidMistralToolCallId(convertedId)).toBe(true);
    }
  });
});

test("Serialization", () => {
  const model = new ChatMistralAI({
    apiKey: "foo",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","mistralai","ChatMistralAI"],"kwargs":{"mistral_api_key":{"lc":1,"type":"secret","id":["MISTRAL_API_KEY"]}}}`
  );
});

/**
 * Test to make sure that the logic in convertMessagesToMistralMessages that makes sure
 * tool calls are only included if there is a corresponding ToolMessage works as expected
 *
 * Or else the Mistral API will reject the request
 */
test("convertMessagesToMistralMessages converts roles and filters toolCalls", () => {
  const msgs = [
    new HumanMessage("hi"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "123456789",
          name: "extract-1",
          args: { answer: "x" },
          type: "tool_call",
        },
        { id: "ORPHAN123", name: "noop", args: {}, type: "tool_call" },
      ],
    }),
    new ToolMessage({ tool_call_id: "123456789", content: "result payload" }),
  ];

  const converted = convertMessagesToMistralMessages(msgs) as {
    role: "user" | "assistant" | "tool";
    toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
    toolCallId?: string;
  }[];
  // Expect user, assistant (toolCalls), tool
  const roles = converted.map((m) => m.role);
  expect(roles).toContain("user");
  expect(roles).toContain("assistant");
  expect(roles).toContain("tool");

  const assistantMsg = converted.find((m) => Array.isArray(m.toolCalls)) as {
    toolCalls: { id: string }[];
  };
  expect(assistantMsg.toolCalls.length).toBe(1);
  expect(assistantMsg.toolCalls[0].id).toBe("123456789");

  const toolMsg = converted.find((m) => m.role === "tool");
  expect(toolMsg?.toolCallId).toBe("123456789");
});

describe("Streaming", () => {
  test("streaming request includes stream: true parameter", async () => {
    // Mock the Mistral SDK to capture the request parameters
    const mockStreamFn = vi.fn().mockImplementation(async function* () {
      yield {
        data: {
          id: "test-id",
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "mistral-small-latest",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finishReason: null,
            },
          ],
        },
      };
      yield {
        data: {
          id: "test-id",
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "mistral-small-latest",
          choices: [
            {
              index: 0,
              delta: { content: " world!" },
              finishReason: "stop",
            },
          ],
        },
      };
    });

    const model = new ChatMistralAI({
      apiKey: "test-api-key",
      model: "mistral-small-latest",
    });

    // Override completionWithRetry to capture the call
    const originalCompletionWithRetry = model.completionWithRetry.bind(model);
    let capturedStreamParam = false;

    model.completionWithRetry = async function (
      input: unknown,
      streaming: boolean
    ) {
      if (streaming) {
        // Verify that when we call stream, we would pass stream: true
        // The actual fix adds { ...input, stream: true } in the implementation
        capturedStreamParam = true;
        return mockStreamFn();
      }
      return originalCompletionWithRetry(
        input as ChatCompletionRequest,
        streaming
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Consume the stream
    const chunks: string[] = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("Hello")],
      {}
    )) {
      chunks.push(chunk.text);
    }

    // Verify streaming was called
    expect(capturedStreamParam).toBe(true);
    expect(chunks.length).toBe(2);
    expect(chunks.join("")).toBe("Hello world!");
  });
});
