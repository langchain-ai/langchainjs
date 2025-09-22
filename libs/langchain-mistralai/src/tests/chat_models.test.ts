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
      ] as any,
    }),
    new ToolMessage({ tool_call_id: "123456789", content: "result payload" }),
  ];

  const converted = convertMessagesToMistralMessages(msgs) as any[];
  // Expect user, assistant (toolCalls), tool
  const roles = converted.map((m) => m.role);
  expect(roles).toContain("user");
  expect(roles).toContain("assistant");
  expect(roles).toContain("tool");

  const assistantMsg = converted.find((m) => Array.isArray(m.toolCalls));
  expect(assistantMsg.toolCalls.length).toBe(1);
  expect(assistantMsg.toolCalls[0].id).toBe("123456789");

  const toolMsg = converted.find((m) => m.role === "tool");
  expect(toolMsg.toolCallId).toBe("123456789");
});
